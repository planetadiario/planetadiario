import type { Bindings, Tendencia } from "./env";
import { itens, tag } from "./xml";

const UA = "Mozilla/5.0 (compatible; PlanetaDiarioBot/1.0; +https://planetadiario.online)";

function trafegoNumero(s?: string): number | null {
  if (!s) return null;
  const m = s.replace(/[+,.\s]/g, "").match(/^(\d+)([KMB])?$/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Number(m[1]) * mult;
}

/** O que está sendo pesquisado agora no Google, por país */
export async function googleTrends(pais: string): Promise<Tendencia[]> {
  const r = await fetch(`https://trends.google.com/trending/rss?geo=${pais}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Google Trends ${pais}: HTTP ${r.status}`);
  const xml = await r.text();
  return itens(xml).map((it) => {
    const titulo = tag(it, "title") ?? "";
    const noticias = itens(it, "ht:news_item").map((n) => ({
      titulo: tag(n, "ht:news_item_title"),
      url: tag(n, "ht:news_item_url"),
      fonte: tag(n, "ht:news_item_source"),
      imagem: tag(n, "ht:news_item_picture"),
    }));
    return {
      fonte: "google_trends",
      pais,
      chave: `${pais}:${titulo.toLowerCase()}`,
      titulo,
      url: noticias[0]?.url ?? null,
      imagem: tag(it, "ht:picture") ?? null,
      trafego: trafegoNumero(tag(it, "ht:approx_traffic")),
      noticias,
      extra: { publicado: tag(it, "pubDate") },
    };
  });
}

interface DmVideo {
  id: string;
  title: string;
  url: string;
  views_last_hour: number;
  views_total: number;
  duration: number;
  created_time: number;
  "owner.screenname": string;
  thumbnail_720_url: string;
  language: string;
}

const DM_CAMPOS = "id,title,url,views_last_hour,views_total,duration,created_time,owner.screenname,thumbnail_720_url,language";

function dmParaTendencia(v: DmVideo, pais: string | null, canal?: string): Tendencia {
  return {
    fonte: "dailymotion",
    pais,
    chave: v.id,
    titulo: v.title,
    url: v.url,
    video_url: v.url,
    imagem: v.thumbnail_720_url,
    trafego: v.views_last_hour,
    extra: {
      autor: v["owner.screenname"],
      duracao: v.duration,
      views: v.views_total,
      idioma: v.language,
      canal,
      publicado: new Date(v.created_time * 1000).toISOString(),
    },
  };
}

/** Vídeos curtos em alta no Dailymotion (últimas 48h) */
export async function dailymotion(pais: string, canal: string): Promise<Tendencia[]> {
  const desde = Math.floor(Date.now() / 1000) - 48 * 3600;
  const url =
    `https://api.dailymotion.com/videos?sort=trending&country=${pais.toLowerCase()}&channel=${canal}` +
    `&shorter_than=4&created_after=${desde}&limit=15&fields=${DM_CAMPOS}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Dailymotion ${pais}/${canal}: HTTP ${r.status}`);
  const { list } = (await r.json()) as { list: DmVideo[] };
  return list.map((v) => dmParaTendencia(v, pais, canal));
}

function duracaoIso(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

interface YtVideo {
  id: string | { videoId: string };
  snippet: { title: string; channelTitle: string; publishedAt: string; defaultAudioLanguage?: string; thumbnails: Record<string, { url: string }> };
  statistics?: { viewCount?: string };
  contentDetails?: { duration: string };
}

function ytParaTendencia(v: YtVideo, pais: string | null): Tendencia {
  const id = typeof v.id === "string" ? v.id : v.id.videoId;
  const t = v.snippet.thumbnails;
  const url = `https://www.youtube.com/watch?v=${id}`;
  return {
    fonte: "youtube",
    pais,
    chave: id,
    titulo: v.snippet.title,
    url,
    video_url: url,
    imagem: (t.maxres ?? t.high ?? t.medium ?? t.default)?.url ?? null,
    trafego: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
    extra: {
      autor: v.snippet.channelTitle,
      duracao: v.contentDetails ? duracaoIso(v.contentDetails.duration) : null,
      idioma: v.snippet.defaultAudioLanguage,
      publicado: v.snippet.publishedAt,
    },
  };
}

/** Vídeos em alta no YouTube por país (precisa de YOUTUBE_API_KEY) */
export async function youtubeEmAlta(env: Bindings, pais: string): Promise<Tendencia[]> {
  if (!env.YOUTUBE_API_KEY) return [];
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
    `&chart=mostPopular&regionCode=${pais}&maxResults=20&key=${env.YOUTUBE_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`YouTube ${pais}: HTTP ${r.status}`);
  const { items } = (await r.json()) as { items: YtVideo[] };
  return items
    .map((v) => ytParaTendencia(v, pais))
    .filter((t) => ((t.extra?.duracao as number) ?? 0) <= 600);
}

/** Busca vídeos sobre um assunto (para o botão "Buscar vídeos" do painel) */
export async function buscarVideos(env: Bindings, q: string) {
  const tarefas: Promise<Tendencia[]>[] = [];
  const desde = new Date(Date.now() - 4 * 86400_000);

  if (env.YOUTUBE_API_KEY) {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&videoDuration=short` +
      `&publishedAfter=${desde.toISOString()}&maxResults=12&q=${encodeURIComponent(q)}&key=${env.YOUTUBE_API_KEY}`;
    tarefas.push(
      fetch(url)
        .then((r) => r.json() as Promise<{ items?: YtVideo[] }>)
        .then((d) => (d.items ?? []).map((v) => ytParaTendencia(v, null))),
    );
  }
  const dm =
    `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&sort=relevance&shorter_than=5` +
    `&created_after=${Math.floor(desde.getTime() / 1000)}&limit=12&fields=${DM_CAMPOS}`;
  tarefas.push(
    fetch(dm)
      .then((r) => r.json() as Promise<{ list?: DmVideo[] }>)
      .then((d) => (d.list ?? []).map((v) => dmParaTendencia(v, null))),
  );

  const res = await Promise.allSettled(tarefas);
  return res.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
