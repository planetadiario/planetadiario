import type { Bindings } from "./env";

/**
 * Publica um Reel na página usando a API oficial de Reels (upload por URL).
 * https://developers.facebook.com/docs/video-api/guides/reels-publishing
 */
export async function publicarReel(env: Bindings, videoUrl: string, descricao: string) {
  const v = env.FB_GRAPH_VERSION;
  const base = `https://graph.facebook.com/${v}/${env.FB_PAGE_ID}/video_reels`;
  const token = env.FB_PAGE_TOKEN;

  // 1. inicia o upload
  const ini = await fbJson(
    await fetch(`${base}?upload_phase=start&access_token=${token}`, { method: "POST" }),
  ) as { video_id: string };

  // 2. o Facebook baixa o arquivo direto da nossa URL pública
  await fbJson(
    await fetch(`https://rupload.facebook.com/video-upload/${v}/${ini.video_id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
    }),
  );

  // 3. finaliza e publica
  const fim = new URLSearchParams({
    upload_phase: "finish",
    video_id: ini.video_id,
    video_state: "PUBLISHED",
    description: descricao,
    access_token: token,
  });
  await fbJson(await fetch(base, { method: "POST", body: fim }));

  return { videoId: ini.video_id, url: `https://www.facebook.com/reel/${ini.video_id}` };
}

/**
 * Publica o mesmo Reel no Instagram ligado à página (conta profissional).
 * https://developers.facebook.com/docs/instagram-platform/content-publishing
 */
export async function publicarReelInstagram(env: Bindings, videoUrl: string, legenda: string) {
  const g = `https://graph.facebook.com/${env.FB_GRAPH_VERSION}`;
  const token = env.FB_PAGE_TOKEN;

  const pagina = (await fbJson(
    await fetch(`${g}/${env.FB_PAGE_ID}?fields=instagram_business_account&access_token=${token}`),
  )) as { instagram_business_account?: { id: string } };
  const igId = pagina.instagram_business_account?.id;
  if (!igId) return null; // página sem Instagram profissional vinculado

  const params = new URLSearchParams({ media_type: "REELS", video_url: videoUrl, caption: legenda, share_to_feed: "true", access_token: token });
  const container = (await fbJson(await fetch(`${g}/${igId}/media`, { method: "POST", body: params }))) as { id: string };

  // o Instagram processa o vídeo antes de liberar a publicação
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    const st = (await fbJson(await fetch(`${g}/${container.id}?fields=status_code&access_token=${token}`))) as { status_code: string };
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Instagram: processamento ${st.status_code}`);
  }

  const pub = (await fbJson(
    await fetch(`${g}/${igId}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: container.id, access_token: token }) }),
  )) as { id: string };
  const link = (await fbJson(await fetch(`${g}/${pub.id}?fields=permalink&access_token=${token}`))) as { permalink?: string };
  return { mediaId: pub.id, url: link.permalink ?? null };
}

/** Curtidas e comentários do Reel no Facebook e no Instagram */
export async function metricasReel(env: Bindings, fbVideoId: string | null, igMediaId: string | null) {
  const g = `https://graph.facebook.com/${env.FB_GRAPH_VERSION}`;
  const t = env.FB_PAGE_TOKEN;
  const m = { fb_curtidas: 0, fb_comentarios: 0, ig_curtidas: 0, ig_comentarios: 0 };
  if (fbVideoId) {
    const r = (await fbJson(
      await fetch(`${g}/${fbVideoId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${t}`),
    )) as { likes?: { summary?: { total_count: number } }; comments?: { summary?: { total_count: number } } };
    m.fb_curtidas = r.likes?.summary?.total_count ?? 0;
    m.fb_comentarios = r.comments?.summary?.total_count ?? 0;
  }
  if (igMediaId) {
    const r = (await fbJson(await fetch(`${g}/${igMediaId}?fields=like_count,comments_count&access_token=${t}`))) as {
      like_count?: number;
      comments_count?: number;
    };
    m.ig_curtidas = r.like_count ?? 0;
    m.ig_comentarios = r.comments_count ?? 0;
  }
  return m;
}

/** Consulta o processamento do Reel no Facebook */
export async function statusReel(env: Bindings, videoId: string) {
  const r = await fetch(
    `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${videoId}?fields=status,permalink_url&access_token=${env.FB_PAGE_TOKEN}`,
  );
  return fbJson(r);
}

async function fbJson(r: Response): Promise<unknown> {
  const corpo = (await r.json().catch(() => ({}))) as { error?: { message: string } };
  if (!r.ok || corpo.error) throw new Error(`Facebook: ${corpo.error?.message ?? `HTTP ${r.status}`}`);
  return corpo;
}
