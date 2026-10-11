import { Hono } from "hono";
import type { Bindings } from "./env";
import { coletar, supa } from "./coleta";
import { buscarVideos } from "./coletores";
import { publicarReel, publicarReelInstagram } from "./facebook";
import { dispararRender } from "./github";

type App = { Bindings: Bindings; Variables: { email: string } };
const app = new Hono<App>().basePath("/api");

app.onError((e, c) => {
  console.error(e);
  return c.json({ erro: e.message }, 500);
});

// Rotas internas (chamadas pelo pipeline do GitHub Actions)
app.post("/interno/publicar/:id", async (c) => {
  if (c.req.header("x-internal-secret") !== c.env.INTERNAL_SECRET) return c.json({ erro: "não autorizado" }, 401);
  return c.json(await publicar(c.env, c.req.param("id")));
});

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
  const descricao = [reel.legenda, tags].filter(Boolean).join("\n\n");

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
  if (!reel.ig_media_id) {
    try {
      const ig = await publicarReelInstagram(env, reel.video_url, descricao);
      if (ig) {
        igUrl = ig.url;
        await db.from("reels").update({ ig_media_id: ig.mediaId, ig_post_url: ig.url }).eq("id", id);
      }
    } catch (e) {
      await db.from("reels").update({ erro: `Instagram: ${e instanceof Error ? e.message : e}` }).eq("id", id);
    }
  }
  await db.from("reels").update({ status: "publicado" }).eq("id", id);
  return { ok: true, url: fbUrl, instagram: igUrl };
}

export default {
  fetch: app.fetch,
  async scheduled(_ctrl, env, ctx) {
    ctx.waitUntil(coletar(env).then(() => undefined));
  },
} satisfies ExportedHandler<Bindings>;
