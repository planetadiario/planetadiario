import { Hono, type Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bindings } from "./env";
import { supa } from "./coleta";
import { consultarFatura, criarPix } from "./lytex";

/** Rotas públicas do site (leitores logados com Google) */
export const site = new Hono<{ Bindings: Bindings }>();

async function leitor(c: Context<{ Bindings: Bindings }>) {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data } = await supa(c.env).auth.getUser(token);
  return data.user ?? null;
}

site.post("/assinar", async (c) => {
  const user = await leitor(c);
  if (!user) return c.json({ erro: "Entre com o Google para assinar" }, 401);
  const { cpf, telefone } = await c.req.json<{ cpf: string; telefone?: string }>();
  const db = supa(c.env);
  const { data: cfg } = await db.from("config").select("valor").eq("chave", "assinatura_preco_centavos").single();
  const valor = Number(cfg?.valor ?? 990);

  const { data: ass, error } = await db
    .from("assinaturas")
    .insert({ usuario_id: user.id, valor_centavos: valor })
    .select("id")
    .single();
  if (error) throw error;
  const pix = await criarPix(
    c.env,
    valor,
    { nome: user.user_metadata?.full_name ?? "", email: user.email ?? "", cpf: cpf ?? "", telefone: telefone ?? "" },
    `PD-${ass.id}`,
  );
  await db.from("assinaturas").update({ fatura_id: pix.id }).eq("id", ass.id);
  return c.json({ fatura: pix.id, pix: pix.pix, valor });
});

site.get("/assinatura/:fatura", async (c) => {
  const user = await leitor(c);
  if (!user) return c.json({ erro: "faça login" }, 401);
  const db = supa(c.env);
  const { data: ass } = await db
    .from("assinaturas")
    .select("*")
    .eq("fatura_id", c.req.param("fatura"))
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (!ass) return c.json({ erro: "assinatura não encontrada" }, 404);
  if (ass.status === "ativa") return c.json({ status: "ativa", fim: ass.fim });
  const fatura = await consultarFatura(c.env, ass.fatura_id);
  if (fatura.status?.toLowerCase() === "paid") return c.json({ status: "ativa", fim: await ativar(db, ass) });
  return c.json({ status: "pendente" });
});

// Webhook da Lytex (configure: https://planetadiario.online/api/site/lytex?s=<LYTEX_CALLBACK_SECRET>)
site.post("/lytex", async (c) => {
  try {
    if (c.env.LYTEX_CALLBACK_SECRET && c.req.query("s") !== c.env.LYTEX_CALLBACK_SECRET) return c.json({ ok: true });
    const corpo = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const dados = (corpo.data ?? corpo) as Record<string, unknown>;
    const id = String(dados._invoiceId ?? dados.invoiceId ?? dados._id ?? "");
    if (!id) return c.json({ ok: true });
    const db = supa(c.env);
    const { data: ass } = await db.from("assinaturas").select("*").eq("fatura_id", id).maybeSingle();
    // nunca confia no corpo do webhook: confirma o status direto na Lytex
    if (ass && ass.status !== "ativa" && (await consultarFatura(c.env, id)).status?.toLowerCase() === "paid") await ativar(db, ass);
  } catch (e) {
    console.log("webhook lytex:", e instanceof Error ? e.message : e);
  }
  return c.json({ ok: true });
});

/** Ativa 30 dias (somando ao período ainda vigente) e dá 100 pontos */
async function ativar(db: SupabaseClient, ass: { id: string; usuario_id: string }) {
  const { data: vigente } = await db
    .from("assinaturas")
    .select("fim")
    .eq("usuario_id", ass.usuario_id)
    .eq("status", "ativa")
    .gt("fim", new Date().toISOString())
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = vigente ? new Date(vigente.fim).getTime() : Date.now();
  const fim = new Date(base + 30 * 86400_000).toISOString();
  const { data: atualizada } = await db
    .from("assinaturas")
    .update({ status: "ativa", inicio: new Date().toISOString(), fim })
    .eq("id", ass.id)
    .neq("status", "ativa")
    .select("id");
  if (atualizada?.length) {
    const { data: p } = await db.from("perfis").select("pontos").eq("id", ass.usuario_id).single();
    await db.from("perfis").update({ pontos: (p?.pontos ?? 0) + 100 }).eq("id", ass.usuario_id);
  }
  return fim;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** /n/:slug — devolve o app com as meta tags da notícia (prévia no WhatsApp/Facebook) */
export async function paginaNoticia(req: Request, env: Bindings) {
  const url = new URL(req.url);
  const html = await env.ASSETS.fetch(new Request(new URL("/", url)));
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  const { data } = await supa(env)
    .from("reels")
    .select("manchete, legenda, thumb_url, exclusivo")
    .eq("slug", slug)
    .not("site_publicado_em", "is", null)
    .maybeSingle();
  if (!data) return html;

  const titulo = esc(`${data.manchete ?? "Notícia"} | Planeta Diário`);
  const desc = esc((data.exclusivo ? "Conteúdo exclusivo para assinantes." : (data.legenda ?? "").split("\n")[0]).slice(0, 200));
  const img = esc(data.thumb_url ?? `${url.origin}/logo.png`);
  const metas = [
    `<meta name="description" content="${desc}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Planeta Diário">`,
    `<meta property="og:title" content="${titulo}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:url" content="${esc(url.href)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("");
  return new HTMLRewriter()
    .on("title", { element: (e) => void e.setInnerContent(titulo, { html: true }) })
    .on('meta[name="description"], meta[property="og:image"]', { element: (e) => void e.remove() })
    .on("head", { element: (e) => void e.append(metas, { html: true }) })
    .transform(html);
}
