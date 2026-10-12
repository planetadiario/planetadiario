import { Hono } from "hono";
import type { Bindings } from "./env";
import { atualizarMetricas, coletar, supa } from "./coleta";
import { buscarVideos } from "./coletores";
import { apagarInstagram, publicarReel, publicarReelInstagram } from "./facebook";
import { dispararRender } from "./github";
import { paginaCategoria, paginaNoticia, site, sitemap } from "./site";
import { gerarAprendizados } from "./aprendizados";

const CRON_METRICAS = "2,32 * * * *";

type App = { Bindings: Bindings; Variables: { email: string } };
const app = new Hono<App>().basePath("/api");

app.onError((e, c) => {
  console.error(e);
  // (12) não revela detalhes internos ao público; mensagens de validação (P0001) e o painel admin continuam claras
  const publico = c.req.path.startsWith("/api/site/");
  const validacao = (e as { code?: string }).code === "P0001" || /CPF|login|Muitas/i.test(e.message);
  return c.json({ erro: publico && !validacao ? "Não foi possível concluir agora. Tente novamente." : e.message }, 500);
});

// cabeçalhos de segurança também nas respostas da API
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Cache-Control", "no-store");
});

// Rotas internas (chamadas pelo pipeline do GitHub Actions)
app.post("/interno/publicar/:id", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  return c.json(await publicar(c.env, c.req.param("id")));
});

app.post("/interno/apagar-instagram/:id", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  const db = supa(c.env);
  const { data: reel } = await db.from("reels").select("ig_media_id").eq("id", c.req.param("id")).single();
  if (!reel?.ig_media_id) return c.json({ erro: "sem post no Instagram" }, 404);
  const r = await apagarInstagram(c.env, reel.ig_media_id);
  await db.from("reels").update({ ig_media_id: null, ig_post_url: null }).eq("id", c.req.param("id"));
  return c.json({ ok: true, r });
});

app.post("/interno/apagar-facebook/:id", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  const db = supa(c.env);
  const { data: reel } = await db.from("reels").select("fb_video_id").eq("id", c.req.param("id")).single();
  if (!reel?.fb_video_id) return c.json({ erro: "sem post no Facebook" }, 404);
  const r = await fetch(`https://graph.facebook.com/${c.env.FB_GRAPH_VERSION}/${reel.fb_video_id}?access_token=${c.env.FB_PAGE_TOKEN}`, { method: "DELETE" });
  const corpo = await r.json();
  if (r.ok) await db.from("reels").update({ fb_video_id: null, fb_post_url: null }).eq("id", c.req.param("id"));
  return c.json({ ok: r.ok, corpo });
});

app.post("/interno/coletar", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  const g = c.req.query("grupo");
  return c.json({ log: await coletar(c.env, g === "par" || g === "impar" ? g : undefined) });
});

app.post("/interno/metricas", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  return c.json({ log: await atualizarMetricas(c.env) });
});

// Site público (leitores)
app.route("/site", site);

// Daqui pra baixo: só administradores logados no painel
app.use("*", async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) return c.json({ erro: "faça login" }, 401);
  const db = supa(c.env);
  const { data, error } = await db.auth.getUser(token);
  const email = data.user?.email;
  if (error || !email) return c.json({ erro: "sessão inválida" }, 401);
  const { data: admin } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  if (!admin) return c.json({ erro: "sem permissão" }, 403);
  c.set("email", email);
  await next();
});

app.post("/coletar", async (c) => c.json({ log: await coletar(c.env) }));

app.post("/aprendizados", async (c) => c.json(await gerarAprendizados(c.env)));

// metas de monetização: seguidores, minutos assistidos (60 dias) e Reels ativos (30 dias)
app.get("/monetizacao", async (c) => {
  const db = supa(c.env);
  const desde60 = new Date(Date.now() - 60 * 86400_000).toISOString();
  const desde30 = Date.now() - 30 * 86400_000;
  const [hist, reels, cfg] = await Promise.all([
    db.from("seguidores_historico").select("dia, fb, ig").order("dia", { ascending: false }).limit(60),
    db.from("reels").select("publicado_em, metricas").eq("status", "publicado").gte("publicado_em", desde60),
    db.from("config").select("valor").eq("chave", "metas_monetizacao").maybeSingle(),
  ]);
  const ms = (m: Record<string, unknown> | null, k: string) => Number(m?.[k] ?? 0);
  const lista = reels.data ?? [];
  const minFb = lista.reduce((s, r) => s + ms(r.metricas, "fb_tempo_total_ms"), 0) / 60000;
  const minIg = lista.reduce((s, r) => s + ms(r.metricas, "ig_tempo_total_ms"), 0) / 60000;
  return c.json({
    metas: cfg.data?.valor ?? { seguidores: 5000, minutos_60d: 60000, reels_30d: 5 },
    seguidores: hist.data?.[0] ?? null,
    historico: (hist.data ?? []).reverse(),
    minutos_60d: { fb: Math.round(minFb), ig: Math.round(minIg) },
    reels_30d: lista.filter((r) => Date.parse(r.publicado_em) >= desde30).length,
    reels_hoje: lista.filter((r) => new Date(r.publicado_em).toDateString() === new Date().toDateString()).length,
  });
});

app.get("/buscar-videos", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ erro: "informe o termo" }, 400);
  return c.json({ videos: await buscarVideos(c.env, q) });
});

app.post("/reels", async (c) => {
  const body = await c.req.json<{
    origem_url: string;
    categoria?: string;
    tendencia_id?: string;
    origem_titulo?: string;
    origem_autor?: string;
    auto_publicar?: boolean;
  }>();
  if (!/^https?:\/\//.test(body.origem_url ?? "")) return c.json({ erro: "link inválido" }, 400);
  const db = supa(c.env);
  const { data, error } = await db
    .from("reels")
    .insert({
      origem_url: body.origem_url,
      categoria: body.categoria ?? "noticias",
      // sem categoria escolhida a dedo, a IA decide pelo assunto do vídeo
      categoria_auto: !body.categoria || !!body.tendencia_id,
      tendencia_id: body.tendencia_id ?? null,
      origem_titulo: body.origem_titulo ?? null,
      origem_autor: body.origem_autor ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  if (body.tendencia_id) await db.from("tendencias").update({ usado: true }).eq("id", body.tendencia_id);
  await dispararRender(c.env, data.id, body.auto_publicar ?? false);
  return c.json({ reel: data });
});

app.post("/reels/:id/renderizar", async (c) => {
  const id = c.req.param("id");
  await supa(c.env).from("reels").update({ status: "na_fila", erro: null }).eq("id", id);
  await dispararRender(c.env, id, false);
  return c.json({ ok: true });
});

app.post("/reels/:id/publicar", async (c) => c.json(await publicar(c.env, c.req.param("id"))));

async function publicar(env: Bindings, id: string) {
  const db = supa(env);
  const { data: reel, error } = await db.from("reels").select("*").eq("id", id).single();
  if (error) throw error;
  if (!reel.video_url) throw new Error("o vídeo ainda não está pronto");
  if (reel.fb_video_id && reel.ig_media_id) return { ok: true, url: reel.fb_post_url };

  await db.from("reels").update({ status: "publicando", erro: null }).eq("id", id);
  const tags = (reel.hashtags as string[]).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  // chamada do Clube de Fundadores no fim de cada legenda (texto próprio por rede; editável em Ajustes)
  const { data: ctas } = await db.from("config").select("chave, valor").in("chave", ["cta_facebook", "cta_instagram"]);
  const cta = Object.fromEntries((ctas ?? []).map((c) => [c.chave, String(c.valor ?? "")]));
  const montar = (chamada?: string) => [reel.legenda, chamada, tags].filter(Boolean).join("\n\n");
  const descricao = montar(cta.cta_facebook);
  const descricaoIg = montar(cta.cta_instagram);

  // Facebook (obrigatório)
  let fbUrl: string | null = reel.fb_post_url;
  if (!reel.fb_video_id) {
    try {
      const fb = await publicarReel(env, reel.video_url, descricao);
      fbUrl = fb.url;
      await db
        .from("reels")
        .update({ status: "publicado", fb_video_id: fb.videoId, fb_post_url: fb.url, publicado_em: new Date().toISOString() })
        .eq("id", id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("reels").update({ status: "pronto", erro: msg }).eq("id", id);
      throw e;
    }
  }

  // Instagram (se houver conta profissional vinculada à página); falha aqui não desfaz o Facebook
  let igUrl: string | null = reel.ig_post_url;
  if (!reel.ig_media_id && !reel.video_ig_url) {
    // nunca posta no Instagram a versão do Facebook: falta a versão na área segura
    await db.from("reels").update({ erro: "Instagram: falta a versão do Instagram; clique em Refazer e publique de novo" }).eq("id", id);
  } else if (!reel.ig_media_id) {
    try {
      const ig = await publicarReelInstagram(env, reel.video_ig_url, descricaoIg);
      if (ig) {
        igUrl = ig.url;
        await db.from("reels").update({ ig_media_id: ig.mediaId, ig_post_url: ig.url }).eq("id", id);
      }
    } catch (e) {
      await db.from("reels").update({ erro: `Instagram: ${e instanceof Error ? e.message : e}` }).eq("id", id);
    }
  }
  // Site: assinantes veem na hora; o público, depois do acesso antecipado
  if (!reel.site_publicado_em) {
    const { data: cfg } = await db.from("config").select("valor").eq("chave", "acesso_antecipado_min").maybeSingle();
    const agora = Date.now();
    await db
      .from("reels")
      .update({
        slug: reel.slug ?? slugify(reel.manchete ?? reel.origem_titulo ?? "noticia", id),
        site_publicado_em: new Date(agora).toISOString(),
        liberado_em: new Date(agora + Number(cfg?.valor ?? 30) * 60_000).toISOString(),
      })
      .eq("id", id);
  }
  await db.from("reels").update({ status: "publicado" }).eq("id", id);
  return { ok: true, url: fbUrl, instagram: igUrl };
}

function slugify(texto: string, id: string) {
  const base = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base}-${id.slice(0, 6)}`;
}

export default {
  fetch(req, env, ctx) {
    const caminho = new URL(req.url).pathname;
    if (caminho.startsWith("/n/")) return paginaNoticia(req, env);
    if (caminho.startsWith("/c/")) return paginaCategoria(req, env);
    if (caminho === "/sitemap.xml" || caminho === "/sitemap-noticias.xml") return sitemap(req, env);
    return app.fetch(req, env, ctx);
  },
  async scheduled(ctrl, env, ctx) {
    if (ctrl.cron === CRON_METRICAS) {
      // uma vez por dia (6h05 em Brasília) a IA revisa o desempenho e atualiza os aprendizados
      const agora = new Date(ctrl.scheduledTime);
      const tarefa = agora.getUTCHours() === 9 && agora.getUTCMinutes() < 30 ? gerarAprendizados(env) : atualizarMetricas(env);
      ctx.waitUntil(tarefa.then(() => undefined));
    }
    else ctx.waitUntil(coletar(env).then(() => undefined));
  },
} satisfies ExportedHandler<Bindings>;
