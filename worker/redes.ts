import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bindings } from "./env";
import { supa } from "./coleta";
import { BOT_USUARIO } from "./telegram-bot";

/**
 * Redes extras: Telegram, Threads, YouTube Shorts e TikTok.
 * Cada uma publica 1 Reel pendente por chamada (rota /interno/redes/:rede, disparada pelo cron via GitHub Actions).
 * Tokens de OAuth ficam na tabela `integracoes` (só a service role acessa).
 */

export const REDES = ["telegram", "threads", "youtube", "tiktok"] as const;
export type Rede = (typeof REDES)[number];

const COLUNA: Record<Rede, { id: string; url: string }> = {
  telegram: { id: "tg_msg_id", url: "tg_url" },
  threads: { id: "threads_id", url: "threads_url" },
  youtube: { id: "yt_id", url: "yt_url" },
  tiktok: { id: "tt_id", url: "tt_url" },
};

// vídeos de emissoras de TV ficam fora do YouTube e do TikTok (identificação automática de direitos autorais)
const TV = /\b(globo|g1|record|sbt|band|cnn|bbc|nbc|abc news|cbs|fox|sky news|euronews|al jazeera|reuters|ap news|associated press|dw|france 24|rtp|sic|tvi|sunrise|9news|7news|itv|channel 4|espn|tnt sports|sportv|premiere|dazn)\b/i;

interface Reel {
  id: string;
  manchete: string | null;
  legenda: string | null;
  hashtags: string[] | null;
  slug: string | null;
  categoria: string | null;
  origem_autor: string | null;
  origem_url: string | null;
  video_url: string;
  video_ig_url: string | null;
  redes_erro: Record<string, string> | null;
}

export async function integracao(db: SupabaseClient, rede: string) {
  const { data } = await db.from("integracoes").select("dados").eq("rede", rede).maybeSingle();
  return (data?.dados ?? null) as Record<string, string | number> | null;
}

export async function salvarIntegracao(db: SupabaseClient, rede: string, dados: Record<string, unknown>) {
  await db.from("integracoes").upsert({ rede, dados, atualizado_em: new Date().toISOString() });
}

const linkSite = (env: Bindings, r: Reel) => (r.slug ? `${env.SITE_URL}/n/${r.slug}` : env.SITE_URL);
const tags = (r: Reel, max = 30) =>
  (r.hashtags ?? []).slice(0, max).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

/** corta no limite sem quebrar emoji nem palavra, com reticências */
function cortar(texto: string, max: number) {
  const limpo = texto.trim();
  const letras = Array.from(limpo);
  if (letras.length <= max) return limpo;
  const parte = letras.slice(0, max - 1).join("");
  return `${parte.slice(0, Math.max(parte.lastIndexOf(" "), Math.floor(parte.length / 2))).trimEnd()}…`;
}

async function baixarVideo(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`vídeo: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Publica o Reel pendente mais antigo (últimas 24 h) na rede indicada */
export async function publicarPendente(env: Bindings, rede: Rede) {
  const db = supa(env);
  const { data: cfg } = await db.from("config").select("valor").eq("chave", "redes").maybeSingle();
  const conf = (cfg?.valor ?? {}) as Record<string, unknown>;
  if (conf[rede] === false) return { rede, pulado: "desligada em Ajustes" };
  if (!(await conectada(env, db, rede))) return { rede, pulado: "não conectada" };

  const col = COLUNA[rede];
  const { data } = await db
    .from("reels")
    .select("id, manchete, legenda, hashtags, slug, categoria, origem_autor, origem_url, video_url, video_ig_url, redes_erro")
    .eq("status", "publicado")
    .is(col.id, null)
    .not("video_url", "is", null)
    .is(`redes_erro->>${rede}`, null)
    .gte("publicado_em", new Date(Date.now() - 24 * 3600_000).toISOString())
    .lt("publicado_em", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("publicado_em", { ascending: false })
    .limit(1);
  const reel = data?.[0] as Reel | undefined;
  if (!reel) return { rede, pulado: "nada pendente" };

  if ((rede === "youtube" || rede === "tiktok") && TV.test(`${reel.origem_autor ?? ""} ${reel.origem_url ?? ""}`)) {
    await marcarErro(db, reel, rede, "pulado: vídeo de emissora de TV");
    return { rede, pulado: "vídeo de emissora" };
  }
  if (rede === "youtube") {
    const limite = Number(conf.youtube_max_dia ?? 6);
    const { count } = await db
      .from("reels")
      .select("id", { count: "exact", head: true })
      .not("yt_id", "is", null)
      .gte("publicado_em", new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((count ?? 0) >= limite) return { rede, pulado: `limite de ${limite} por dia (cota da API)` };
  }

  try {
    const res =
      rede === "telegram" ? await telegram(env, reel)
      : rede === "threads" ? await threads(env, db, reel)
      : rede === "youtube" ? await youtube(env, db, reel)
      : await tiktok(env, db, reel);
    await db.from("reels").update({ [col.id]: res.id, [col.url]: res.url }).eq("id", reel.id);
    return { rede, reel: reel.id, ...res };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await marcarErro(db, reel, rede, msg.slice(0, 300));
    return { rede, reel: reel.id, erro: msg };
  }
}

async function marcarErro(db: SupabaseClient, reel: Reel, rede: Rede, msg: string) {
  await db.from("reels").update({ redes_erro: { ...(reel.redes_erro ?? {}), [rede]: msg } }).eq("id", reel.id);
}

async function conectada(env: Bindings, db: SupabaseClient, rede: Rede) {
  if (rede === "telegram") return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CANAL);
  return !!(await integracao(db, rede));
}

/** Situação de cada rede para o painel */
export async function situacaoRedes(env: Bindings) {
  const db = supa(env);
  const { data: cfg } = await db.from("config").select("valor").eq("chave", "redes").maybeSingle();
  const conf = (cfg?.valor ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const rede of REDES) {
    const dados = rede === "telegram" ? null : await integracao(db, rede);
    const { count } = await db.from("reels").select("id", { count: "exact", head: true }).not(COLUNA[rede].id, "is", null);
    out[rede] = {
      conectada: await conectada(env, db, rede),
      ligada: conf[rede] !== false,
      conta: rede === "telegram" ? env.TELEGRAM_CANAL ?? null : dados?.nome ?? null,
      posts: count ?? 0,
      app_configurado:
        rede === "telegram" ? !!env.TELEGRAM_BOT_TOKEN
        : rede === "threads" ? !!(env.THREADS_APP_ID && env.THREADS_APP_SECRET)
        : rede === "youtube" ? !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
        : !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
    };
  }
  return { redes: out, youtube_max_dia: Number(conf.youtube_max_dia ?? 6) };
}

/* ------------------------------ Telegram ------------------------------ */

async function telegram(env: Bindings, r: Reel) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const link = linkSite(env, r);
  // limite de 1024 caracteres da legenda do Telegram: o link nunca é cortado
  const legenda = `<b>${esc(r.manchete ?? "")}</b>\n\n${esc(cortar(r.legenda ?? "", 600))}\n\n<a href="${link}">Leia no Planeta Diário</a>`;
  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CANAL!);
  form.append("caption", legenda);
  form.append("parse_mode", "HTML");
  form.append("supports_streaming", "true");
  form.append(
    "reply_markup",
    JSON.stringify({
      inline_keyboard: [
        [{ text: "📰 Ler no site", url: link }],
        [{ text: "⚡ Receba antes de todo mundo (Pro)", url: `https://t.me/${BOT_USUARIO}?start=pro` }],
      ],
    }),
  );
  form.append("width", "1080");
  form.append("height", "1920");
  form.append("video", new Blob([await baixarVideo(r.video_url)], { type: "video/mp4" }), "reel.mp4");
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVideo`, { method: "POST", body: form });
  const j = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number; chat?: { username?: string } } };
  if (!j.ok || !j.result) throw new Error(`Telegram: ${j.description ?? res.status}`);
  const user = j.result.chat?.username ?? String(env.TELEGRAM_CANAL).replace(/^@/, "");
  return { id: String(j.result.message_id), url: `https://t.me/${user}/${j.result.message_id}` };
}

/* ------------------------------ Threads ------------------------------ */

async function tokenThreads(env: Bindings, db: SupabaseClient) {
  const d = await integracao(db, "threads");
  if (!d) throw new Error("Threads não conectado");
  // token de 60 dias: renova quando faltar menos de 10
  if (Number(d.expira ?? 0) - Date.now() < 10 * 86400_000) {
    const r = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${d.token}`);
    const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (j.access_token) {
      d.token = j.access_token;
      d.expira = Date.now() + (j.expires_in ?? 5184000) * 1000;
      await salvarIntegracao(db, "threads", d);
    }
  }
  return d as { token: string; user_id: string };
}

async function threadsJson(r: Response) {
  const j = (await r.json()) as Record<string, unknown> & { error?: { message: string } };
  if (!r.ok || j.error) throw new Error(`Threads: ${j.error?.message ?? r.status}`);
  return j;
}

async function threads(env: Bindings, db: SupabaseClient, r: Reel) {
  const { token, user_id } = await tokenThreads(env, db);
  const g = "https://graph.threads.net/v1.0";
  // o link vai sempre inteiro no fim; quem encurta é a legenda (limite de 500 caracteres do Threads)
  const link = linkSite(env, r);
  const texto = `${cortar(`${r.manchete ?? ""}\n\n${r.legenda ?? ""}`, 480 - link.length)}\n\n${link}`;
  const c = await threadsJson(
    await fetch(`${g}/${user_id}/threads`, {
      method: "POST",
      body: new URLSearchParams({ media_type: "VIDEO", video_url: r.video_url, text: texto, access_token: token }),
    }),
  );
  for (let i = 0; i < 18; i++) {
    await new Promise((ok) => setTimeout(ok, 10_000));
    const st = await threadsJson(await fetch(`${g}/${c.id}?fields=status,error_message&access_token=${token}`));
    if (st.status === "FINISHED") break;
    if (st.status === "ERROR" || st.status === "EXPIRED") throw new Error(`Threads: ${st.error_message ?? st.status}`);
  }
  const pub = await threadsJson(
    await fetch(`${g}/${user_id}/threads_publish`, { method: "POST", body: new URLSearchParams({ creation_id: String(c.id), access_token: token }) }),
  );
  const perm = await threadsJson(await fetch(`${g}/${pub.id}?fields=permalink&access_token=${token}`)).catch(() => ({}) as Record<string, unknown>);
  return { id: String(pub.id), url: (perm.permalink as string) ?? null };
}

/* ------------------------------ YouTube ------------------------------ */

async function tokenGoogle(env: Bindings, db: SupabaseClient) {
  const d = await integracao(db, "youtube");
  if (!d?.refresh_token) throw new Error("YouTube não conectado");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: String(d.refresh_token),
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!j.access_token) throw new Error(`YouTube: ${j.error_description ?? j.error ?? r.status}`);
  return j.access_token;
}

async function youtube(env: Bindings, db: SupabaseClient, r: Reel) {
  const token = await tokenGoogle(env, db);
  const video = await baixarVideo(r.video_ig_url ?? r.video_url);
  const titulo = (r.manchete ?? "Planeta Diário").replace(/[<>]/g, "").slice(0, 90) + " #Shorts";
  const descricao = `${r.legenda ?? ""}\n\nMais notícias: ${linkSite(env, r)}\n\n${tags(r, 15)}`.replace(/[<>]/g, "").slice(0, 4900);
  const ini = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(video.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title: titulo,
        description: descricao,
        tags: (r.hashtags ?? []).map((h) => h.replace(/^#/, "")).slice(0, 15),
        categoryId: "25", // Notícias e política
        defaultLanguage: "pt-BR",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  const destino = ini.headers.get("Location");
  if (!ini.ok || !destino) throw new Error(`YouTube: ${(await ini.text()).slice(0, 200)}`);
  const up = await fetch(destino, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: video });
  const j = (await up.json()) as { id?: string; error?: { message: string } };
  if (!j.id) throw new Error(`YouTube: ${j.error?.message ?? up.status}`);
  return { id: j.id, url: `https://youtube.com/shorts/${j.id}` };
}

/* ------------------------------ TikTok ------------------------------ */

async function tokenTikTok(env: Bindings, db: SupabaseClient) {
  const d = await integracao(db, "tiktok");
  if (!d?.refresh_token) throw new Error("TikTok não conectado");
  if (Number(d.expira ?? 0) - Date.now() > 5 * 60_000) return String(d.access_token);
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      client_secret: env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: String(d.refresh_token),
    }),
  });
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!j.access_token) throw new Error(`TikTok: ${j.error_description ?? r.status}`);
  await salvarIntegracao(db, "tiktok", {
    ...d,
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? d.refresh_token,
    expira: Date.now() + (j.expires_in ?? 86400) * 1000,
  });
  return j.access_token;
}

async function tiktok(env: Bindings, db: SupabaseClient, r: Reel) {
  const token = await tokenTikTok(env, db);
  const api = "https://open.tiktokapis.com/v2/post/publish";
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };
  const info = (await (await fetch(`${api}/creator_info/query/`, { method: "POST", headers: h })).json()) as {
    data?: { privacy_level_options?: string[] };
    error?: { code: string; message: string };
  };
  if (info.error && info.error.code !== "ok") throw new Error(`TikTok: ${info.error.message}`);
  const opcoes = info.data?.privacy_level_options ?? [];
  // app ainda não auditado pelo TikTok só pode postar como privado
  const privacidade = opcoes.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";

  const video = await baixarVideo(r.video_ig_url ?? r.video_url);
  const ini = (await (
    await fetch(`${api}/video/init/`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        post_info: {
          title: `${r.manchete ?? ""} ${tags(r, 5)}`.slice(0, 2100),
          privacy_level: privacidade,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: { source: "FILE_UPLOAD", video_size: video.byteLength, chunk_size: video.byteLength, total_chunk_count: 1 },
      }),
    })
  ).json()) as { data?: { publish_id: string; upload_url: string }; error?: { code: string; message: string } };
  if (!ini.data?.upload_url) throw new Error(`TikTok: ${ini.error?.message ?? "sem upload_url"}`);
  const up = await fetch(ini.data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${video.byteLength - 1}/${video.byteLength}` },
    body: video,
  });
  if (!up.ok) throw new Error(`TikTok upload: HTTP ${up.status}`);
  return { id: ini.data.publish_id, url: privacidade === "SELF_ONLY" ? null : null };
}

/* ------------------------------ OAuth (conectar contas) ------------------------------ */

async function assinar(env: Bindings, texto: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.INTERNAL_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}

async function estado(env: Bindings, rede: string) {
  const base = `${rede}.${Date.now() + 15 * 60_000}`;
  return `${base}.${await assinar(env, base)}`;
}

async function estadoValido(env: Bindings, rede: string, state: string) {
  const [r, exp, sig] = state.split(".");
  return r === rede && Number(exp) > Date.now() && sig === (await assinar(env, `${r}.${exp}`));
}

const retorno = (env: Bindings, rede: string) => `${env.SITE_URL}/api/oauth/${rede}`;

/** URL de autorização (o admin abre no navegador) */
export async function urlConectar(env: Bindings, rede: Rede) {
  const state = await estado(env, rede);
  if (rede === "youtube") {
    if (!env.GOOGLE_CLIENT_ID) throw new Error("falta GOOGLE_CLIENT_ID");
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: retorno(env, rede),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    })}`;
  }
  if (rede === "tiktok") {
    if (!env.TIKTOK_CLIENT_KEY) throw new Error("falta TIKTOK_CLIENT_KEY");
    return `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      redirect_uri: retorno(env, rede),
      response_type: "code",
      scope: "user.info.basic,video.publish,video.upload",
      state,
    })}`;
  }
  if (rede === "threads") {
    if (!env.THREADS_APP_ID) throw new Error("falta THREADS_APP_ID");
    return `https://threads.net/oauth/authorize?${new URLSearchParams({
      client_id: env.THREADS_APP_ID,
      redirect_uri: retorno(env, rede),
      response_type: "code",
      scope: "threads_basic,threads_content_publish,threads_manage_insights",
      state,
    })}`;
  }
  throw new Error("o Telegram se conecta pelo token do bot");
}

/** Volta da autorização: troca o código por tokens e guarda */
export async function concluirConexao(env: Bindings, rede: Rede, code: string, state: string) {
  if (!(await estadoValido(env, rede, state))) throw new Error("link de conexão expirado; tente de novo pelo painel");
  const db = supa(env);
  if (rede === "youtube") {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: retorno(env, rede),
        grant_type: "authorization_code",
      }),
    });
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; error_description?: string };
    if (!j.refresh_token) throw new Error(`YouTube: ${j.error_description ?? "sem refresh_token"}`);
    const canal = (await (
      await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${j.access_token}` } })
    ).json()) as { items?: { id: string; snippet: { title: string } }[] };
    await salvarIntegracao(db, rede, { refresh_token: j.refresh_token, nome: canal.items?.[0]?.snippet.title ?? null, canal_id: canal.items?.[0]?.id ?? null });
  } else if (rede === "tiktok") {
    const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY!,
        client_secret: env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: retorno(env, rede),
      }),
    });
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; error_description?: string };
    if (!j.access_token) throw new Error(`TikTok: ${j.error_description ?? r.status}`);
    const u = (await (
      await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", { headers: { Authorization: `Bearer ${j.access_token}` } })
    ).json()) as { data?: { user?: { display_name?: string } } };
    await salvarIntegracao(db, rede, {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expira: Date.now() + (j.expires_in ?? 86400) * 1000,
      open_id: j.open_id,
      nome: u.data?.user?.display_name ?? null,
    });
  } else if (rede === "threads") {
    const r = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: env.THREADS_APP_ID!,
        client_secret: env.THREADS_APP_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: retorno(env, rede),
      }),
    });
    const curto = (await r.json()) as { access_token?: string; user_id?: string | number; error_message?: string };
    if (!curto.access_token) throw new Error(`Threads: ${curto.error_message ?? r.status}`);
    const longo = (await (
      await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.THREADS_APP_SECRET}&access_token=${curto.access_token}`)
    ).json()) as { access_token?: string; expires_in?: number };
    const token = longo.access_token ?? curto.access_token;
    const eu = (await (await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`)).json()) as { id?: string; username?: string };
    await salvarIntegracao(db, rede, {
      token,
      user_id: String(eu.id ?? curto.user_id),
      nome: eu.username ? `@${eu.username}` : null,
      expira: Date.now() + (longo.expires_in ?? 3600) * 1000,
    });
  }
}

/* ------------------------------ Métricas das redes extras ------------------------------ */

/**
 * Seguidores do dia (YouTube, Telegram, Threads) e visualizações de cada Short.
 * Roda numa execução própria (/interno/metricas-redes) para não somar chamadas com as do Facebook/Instagram.
 */
export async function metricasRedes(env: Bindings) {
  const db = supa(env);
  const log: string[] = [];
  const hoje: Record<string, number> = {};

  // YouTube: inscritos do canal e estatísticas dos Shorts (1 chamada para até 50 vídeos)
  const yt = await integracao(db, "youtube");
  if (yt?.canal_id && env.YOUTUBE_API_KEY) {
    try {
      const c = (await (
        await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${yt.canal_id}&key=${env.YOUTUBE_API_KEY}`)
      ).json()) as { items?: { statistics: { subscriberCount?: string } }[] };
      hoje.yt = Number(c.items?.[0]?.statistics.subscriberCount ?? 0);
    } catch (e) {
      log.push(`youtube canal: ${e instanceof Error ? e.message : e}`);
    }
    const { data: shorts } = await db
      .from("reels")
      .select("id, yt_id, metricas")
      .not("yt_id", "is", null)
      .gte("publicado_em", new Date(Date.now() - 90 * 86400_000).toISOString())
      .order("publicado_em", { ascending: false })
      .limit(30);
    if (shorts?.length) {
      const v = (await (
        await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${shorts.map((s) => s.yt_id).join(",")}&key=${env.YOUTUBE_API_KEY}`)
      ).json()) as { items?: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] };
      const porId = new Map((v.items ?? []).map((i) => [i.id, i.statistics]));
      for (const s of shorts) {
        const st = porId.get(s.yt_id!);
        if (!st) continue;
        const metricas = {
          ...(s.metricas ?? {}),
          yt_views: Number(st.viewCount ?? 0),
          yt_curtidas: Number(st.likeCount ?? 0),
          yt_comentarios: Number(st.commentCount ?? 0),
        };
        await db.from("reels").update({ metricas }).eq("id", s.id);
      }
      log.push(`youtube: ${porId.size} Shorts atualizados`);
    }
  }

  // Telegram: inscritos do canal
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CANAL) {
    const r = (await (
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMemberCount?chat_id=${encodeURIComponent(env.TELEGRAM_CANAL)}`)
    ).json()) as { ok: boolean; result?: number };
    if (r.ok) hoje.tg = r.result ?? 0;
  }

  // Threads: seguidores (precisa da permissão de insights; sem ela, fica em branco)
  const th = await integracao(db, "threads");
  if (th?.token) {
    const r = (await (
      await fetch(`https://graph.threads.net/v1.0/${th.user_id}/threads_insights?metric=followers_count&access_token=${th.token}`)
    ).json()) as { data?: { total_value?: { value: number } }[]; error?: { message: string } };
    if (r.data?.[0]?.total_value) hoje.threads = r.data[0].total_value.value;
    else if (r.error) log.push(`threads: ${r.error.message.slice(0, 80)}`);
  }

  if (Object.keys(hoje).length) {
    const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await db.from("seguidores_historico").upsert({ dia, ...hoje, atualizado_em: new Date().toISOString() });
  }
  log.push(`seguidores: ${JSON.stringify(hoje)}`);
  return log;
}
