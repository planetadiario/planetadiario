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

// LGPD: o leitor pode apagar a própria conta e os dados ligados a ela
site.delete("/conta", async (c) => {
  const user = await leitor(c);
  if (!user) return c.json({ erro: "faça login" }, 401);
  const { error } = await supa(c.env).auth.admin.deleteUser(user.id);
  if (error) throw error;
  return c.json({ ok: true });
});

// ---------- Clube de Fundadores (pagamento único) ----------

site.post("/fundador", async (c) => {
  const user = await leitor(c);
  if (!user) return c.json({ erro: "Entre com o Google para ser fundador" }, 401);
  const { cpf, telefone, nome_mural } = await c.req.json<{ cpf: string; telefone?: string; nome_mural?: string }>();
  const db = supa(c.env);
  const { data: cfg } = await db.from("config").select("valor").eq("chave", "fundador_preco_centavos").single();
  const valor = Number(cfg?.valor ?? 1590);
  const { data: f, error } = await db
    .from("fundadores")
    .insert({ usuario_id: user.id, valor_centavos: valor, nome_mural: (nome_mural ?? "").trim().slice(0, 40) || null })
    .select("id")
    .single();
  if (error) throw error;
  const pix = await criarPix(
    c.env,
    valor,
    { nome: user.user_metadata?.full_name ?? "", email: user.email ?? "", cpf: cpf ?? "", telefone: telefone ?? "" },
    `PD-FUND-${f.id}`,
    "Fundador Planeta Diário (pagamento único)",
  );
  await db.from("fundadores").update({ fatura_id: pix.id }).eq("id", f.id);
  return c.json({ fatura: pix.id, pix: pix.pix, valor });
});

site.get("/fundador/:fatura", async (c) => {
  const user = await leitor(c);
  if (!user) return c.json({ erro: "faça login" }, 401);
  const db = supa(c.env);
  const { data: f } = await db.from("fundadores").select("*").eq("fatura_id", c.req.param("fatura")).eq("usuario_id", user.id).maybeSingle();
  if (!f) return c.json({ erro: "pedido não encontrado" }, 404);
  if (f.status === "ativo") return c.json({ status: "ativo", numero: f.numero });
  const fatura = await consultarFatura(c.env, f.fatura_id);
  if (fatura.status?.toLowerCase() !== "paid") return c.json({ status: "pendente" });
  const { data: numero, error } = await db.rpc("ativar_fundador", { p_id: f.id });
  if (error) throw error;
  return c.json({ status: "ativo", numero });
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
    if (!ass) {
      const { data: f } = await db.from("fundadores").select("id, status").eq("fatura_id", id).maybeSingle();
      if (f && f.status !== "ativo" && (await consultarFatura(c.env, id)).status?.toLowerCase() === "paid") await db.rpc("ativar_fundador", { p_id: f.id });
    }
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
const semEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();

const CATEGORIAS: Record<string, string> = {
  noticias: "Brasil", urgente: "Urgente", mundo: "Mundo", esportes: "Esportes", famosos: "Famosos", viral: "Viral",
  curiosidades: "Curiosidades", emocionante: "Emocionante", animais: "Animais", natureza: "Natureza", ciencia: "Ciência",
  tecnologia: "Tecnologia", saude: "Saúde", economia: "Economia", policia: "Polícia", humor: "Humor",
};

/** /n/:slug — HTML com meta tags, dados estruturados (NewsArticle) e o texto já renderizado para buscadores */
export async function paginaNoticia(req: Request, env: Bindings) {
  const url = new URL(req.url);
  const html = await env.ASSETS.fetch(new Request(new URL("/", url)));
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  const { data } = await supa(env)
    .from("reels")
    .select("manchete, legenda, artigo, thumb_url, video_url, exclusivo, categoria, site_publicado_em, liberado_em, atualizado_em, origem_autor")
    .eq("slug", slug)
    .not("site_publicado_em", "is", null)
    .maybeSingle();
  if (!data) return html;

  // antes de liberar ao público (acesso antecipado) ou se exclusivo: só os metadados, sem o texto
  const liberado = !data.liberado_em || Date.parse(data.liberado_em) <= Date.now();
  const aberto = liberado && !data.exclusivo;
  const canonica = `${url.origin}/n/${slug}`;
  const manchete = data.manchete ?? "Notícia";
  const titulo = esc(`${manchete} | Planeta Diário`);
  const paragrafos = (data.artigo ?? data.legenda ?? "")
    .split(/\n\s*\n/)
    .map(semEmoji)
    .filter((p: string) => p && !/^(Siga a Planeta|Créditos|#)/i.test(p));
  const desc = esc((data.exclusivo ? "Conteúdo exclusivo para assinantes do Planeta Diário." : paragrafos[0] ?? manchete).slice(0, 200));
  const img = esc(data.thumb_url ?? `${url.origin}/icone-512.png`);
  const categoria = CATEGORIAS[data.categoria] ?? "Notícias";

  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: manchete.slice(0, 110),
    description: paragrafos[0] ?? manchete,
    image: [data.thumb_url ?? `${url.origin}/icone-512.png`],
    datePublished: data.site_publicado_em,
    dateModified: data.atualizado_em ?? data.site_publicado_em,
    articleSection: categoria,
    inLanguage: "pt-BR",
    mainEntityOfPage: canonica,
    isAccessibleForFree: !data.exclusivo,
    author: { "@type": "Organization", name: "Planeta Diário", url: url.origin },
    publisher: { "@type": "Organization", name: "Planeta Diário", logo: { "@type": "ImageObject", url: `${url.origin}/icone-512.png` } },
    ...(data.video_url && aberto
      ? { video: { "@type": "VideoObject", name: manchete, description: paragrafos[0] ?? manchete, thumbnailUrl: data.thumb_url, contentUrl: data.video_url, uploadDate: data.site_publicado_em } }
      : {}),
  };

  const metas = [
    `<meta name="description" content="${desc}">`,
    `<link rel="canonical" href="${esc(canonica)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Planeta Diário">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:title" content="${titulo}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:url" content="${esc(canonica)}">`,
    `<meta property="article:published_time" content="${esc(data.site_publicado_em)}">`,
    `<meta property="article:section" content="${esc(categoria)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${titulo}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${img}">`,
    liberado ? "" : `<meta name="robots" content="noindex">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ].join("");

  // conteúdo legível sem JavaScript (o app substitui ao carregar)
  const corpo = `<article style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:sans-serif">
<p><a href="/c/${esc(data.categoria)}">${esc(categoria)}</a> · <time datetime="${esc(data.site_publicado_em)}">${new Date(data.site_publicado_em).toLocaleDateString("pt-BR")}</time></p>
<h1>${esc(manchete)}</h1>
${data.thumb_url ? `<img src="${img}" alt="${esc(manchete)}" width="360" height="640" style="max-width:100%;height:auto">` : ""}
${aberto ? paragrafos.map((p: string) => `<p>${esc(p)}</p>`).join("") : "<p>Conteúdo disponível para assinantes do Planeta Diário.</p>"}
${aberto && data.origem_autor ? `<p>Vídeo: ${esc(data.origem_autor)}</p>` : ""}
</article>`;

  return new HTMLRewriter()
    .on("title", { element: (e) => void e.setInnerContent(titulo, { html: true }) })
    .on('meta[name="description"], meta[property="og:image"], link[rel="canonical"]', { element: (e) => void e.remove() })
    .on("head", { element: (e) => void e.append(metas, { html: true }) })
    .on("#root", { element: (e) => void e.setInnerContent(corpo, { html: true }) })
    .transform(html);
}

/** /c/:categoria — título e descrição próprios para cada categoria */
export async function paginaCategoria(req: Request, env: Bindings) {
  const url = new URL(req.url);
  const html = await env.ASSETS.fetch(new Request(new URL("/", url)));
  const slug = url.pathname.split("/")[2] ?? "";
  const nome = CATEGORIAS[slug];
  if (!nome) return html;
  const titulo = esc(`${nome}: últimas notícias em vídeo | Planeta Diário`);
  const desc = esc(`As últimas notícias de ${nome.toLowerCase()} em vídeo, atualizadas a todo momento pelo Planeta Diário.`);
  const canonica = esc(`${url.origin}/c/${slug}`);
  return new HTMLRewriter()
    .on("title", { element: (e) => void e.setInnerContent(titulo, { html: true }) })
    .on('meta[name="description"]', { element: (e) => void e.remove() })
    .on("head", {
      element: (e) =>
        void e.append(
          `<meta name="description" content="${desc}"><link rel="canonical" href="${canonica}"><meta property="og:title" content="${titulo}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${canonica}">`,
          { html: true },
        ),
    })
    .transform(html);
}

/** sitemap.xml (todas as páginas) e sitemap-noticias.xml (Google Notícias, últimas 48 h) */
export async function sitemap(req: Request, env: Bindings) {
  const url = new URL(req.url);
  const noticias = url.pathname === "/sitemap-noticias.xml";
  const agora = new Date().toISOString();
  let q = supa(env)
    .from("reels")
    .select("slug, manchete, site_publicado_em, atualizado_em, thumb_url")
    .not("site_publicado_em", "is", null)
    .lte("liberado_em", agora)
    .order("site_publicado_em", { ascending: false })
    .limit(noticias ? 1000 : 5000);
  if (noticias) q = q.gte("site_publicado_em", new Date(Date.now() - 48 * 3600_000).toISOString());
  const { data } = await q;
  const o = url.origin;

  let xml: string;
  if (noticias) {
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${(data ?? [])
  .map(
    (n) => `<url><loc>${o}/n/${esc(n.slug)}</loc><news:news><news:publication><news:name>Planeta Diário</news:name><news:language>pt</news:language></news:publication><news:publication_date>${n.site_publicado_em}</news:publication_date><news:title>${esc(n.manchete ?? "")}</news:title></news:news></url>`,
  )
  .join("\n")}
</urlset>`;
  } else {
    const fixas = ["/", "/reels", "/assinar", "/fundadores", "/fundadores/mural", ...Object.keys(CATEGORIAS).map((c) => `/c/${c}`)];
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${fixas.map((p) => `<url><loc>${o}${p}</loc><changefreq>hourly</changefreq></url>`).join("\n")}
${(data ?? [])
  .map(
    (n) => `<url><loc>${o}/n/${esc(n.slug)}</loc><lastmod>${n.atualizado_em ?? n.site_publicado_em}</lastmod>${n.thumb_url ? `<image:image><image:loc>${esc(n.thumb_url)}</image:loc></image:image>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;
  }
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
