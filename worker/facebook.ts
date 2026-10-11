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
