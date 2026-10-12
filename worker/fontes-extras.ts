import type { Tendencia } from "./env";
import { decodificar, itens, tag } from "./xml";

const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

const semHtml = (s: string) =>
  decodificar(s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

function duracaoTexto(s?: string) {
  if (!s) return null;
  const p = s.split(":").map(Number);
  return p.reduce((t, n) => t * 60 + n, 0);
}

/**
 * Canal público do Telegram (página t.me/s/canal).
 * Muitos canais de última hora postam o vídeo antes da imprensa.
 */
export async function telegram(canal: string): Promise<Tendencia[]> {
  const r = await fetch(`https://t.me/s/${canal}`, { headers: { "User-Agent": NAVEGADOR } });
  if (!r.ok) throw new Error(`Telegram ${canal}: HTTP ${r.status}`);
  const html = await r.text();
  const limite = Date.now() - 24 * 3600_000;

  return html
    .split(/(?=<div class="tgme_widget_message_wrap)/)
    .map((b) => {
      const post = b.match(/data-post="([^"]+)"/)?.[1];
      const quando = b.match(/<time[^>]+datetime="([^"]+)"/)?.[1];
      if (!post || !quando || Date.parse(quando) < limite) return null;
      const texto = semHtml(b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
      const temVideo = b.includes("tgme_widget_message_video_player");
      if (!texto && !temVideo) return null;
      const thumb = b.match(/tgme_widget_message_video_thumb"[^>]*background-image:url\('([^']+)'\)/)?.[1];
      const foto = b.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1];
      const url = `https://t.me/${post}`;
      const t: Tendencia = {
        fonte: "telegram",
        pais: null,
        chave: post,
        titulo: (texto || `Vídeo de ${canal}`).slice(0, 300),
        url,
        video_url: temVideo ? url : null,
        imagem: thumb ?? foto ?? null,
        extra: {
          autor: canal,
          duracao: duracaoTexto(b.match(/message_video_duration[^>]*>([\d:]+)</)?.[1]),
          publicado: quando,
        },
      };
      return t;
    })
    .filter((t): t is Tendencia => t !== null);
}

const GN_IDIOMA: Record<string, string> = {
  BR: "hl=pt-BR&gl=BR&ceid=BR:pt-419",
  PT: "hl=pt-PT&gl=PT&ceid=PT:pt-150",
  US: "hl=en-US&gl=US&ceid=US:en",
  GB: "hl=en-GB&gl=GB&ceid=GB:en",
  IN: "hl=en-IN&gl=IN&ceid=IN:en",
  MX: "hl=es-419&gl=MX&ceid=MX:es-419",
  AR: "hl=es-419&gl=AR&ceid=AR:es-419",
  ES: "hl=es&gl=ES&ceid=ES:es",
  FR: "hl=fr&gl=FR&ceid=FR:fr",
  DE: "hl=de&gl=DE&ceid=DE:de",
  JP: "hl=ja&gl=JP&ceid=JP:ja",
  KR: "hl=ko&gl=KR&ceid=KR:ko",
};

/** Principais manchetes do Google Notícias por país (últimas 6 horas) */
export async function googleNoticias(pais: string): Promise<Tendencia[]> {
  const params = GN_IDIOMA[pais];
  if (!params) return [];
  const r = await fetch(`https://news.google.com/rss?${params}`, { headers: { "User-Agent": NAVEGADOR } });
  if (!r.ok) throw new Error(`Google Notícias ${pais}: HTTP ${r.status}`);
  const limite = Date.now() - 6 * 3600_000;
  return itens(await r.text())
    .map((it) => {
      const publicado = tag(it, "pubDate");
      if (publicado && Date.parse(publicado) < limite) return null;
      const fonte = tag(it, "source") ?? "";
      const titulo = (tag(it, "title") ?? "").replace(new RegExp(`\\s+-\\s+${fonte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
      const url = tag(it, "link") ?? "";
      if (!titulo || !url) return null;
      const t: Tendencia = {
        fonte: "google_news",
        pais,
        chave: url,
        titulo,
        url,
        noticias: [{ titulo, url, fonte }],
        extra: { autor: fonte, publicado },
      };
      return t;
    })
    .filter((t): t is Tendencia => t !== null)
    .slice(0, 20);
}

let sessaoBsky: { jwt: string; expira: number } | null = null;

/** Vídeos virais do feed "Em alta" (What's Hot) do Bluesky */
export async function bluesky(usuario?: string, senha?: string): Promise<Tendencia[]> {
  if (!usuario || !senha) return [];
  if (!sessaoBsky || sessaoBsky.expira < Date.now()) {
    const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: usuario, password: senha }),
    });
    const s = (await r.json()) as { accessJwt?: string; message?: string };
    if (!s.accessJwt) throw new Error(`Bluesky login: ${s.message ?? r.status}`);
    sessaoBsky = { jwt: s.accessJwt, expira: Date.now() + 90 * 60_000 };
  }
  const feed = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
  const r = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=100`, {
    headers: { Authorization: `Bearer ${sessaoBsky.jwt}` },
  });
  if (!r.ok) throw new Error(`Bluesky feed: HTTP ${r.status}`);
  const d = (await r.json()) as {
    feed: {
      post: {
        uri: string;
        author: { handle: string };
        record: { text?: string; createdAt?: string; langs?: string[] };
        embed?: { $type: string; thumbnail?: string };
        likeCount?: number;
        indexedAt: string;
      };
    }[];
  };
  return d.feed
    .map((f) => f.post)
    .filter((p) => p.embed?.$type?.startsWith("app.bsky.embed.video") && (p.likeCount ?? 0) >= 100)
    .map((p) => {
      const url = `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`;
      return {
        fonte: "bluesky",
        pais: null,
        chave: p.uri,
        titulo: (p.record.text || `Vídeo de ${p.author.handle}`).slice(0, 300),
        url,
        video_url: url,
        imagem: p.embed?.thumbnail ?? null,
        trafego: p.likeCount ?? 0,
        extra: { autor: p.author.handle, publicado: p.record.createdAt ?? p.indexedAt, idioma: p.record.langs?.[0] },
      } satisfies Tendencia;
    });
}

// GDELT usa códigos FIPS de país
const FIPS: Record<string, string> = { BR: "BR", US: "US", GB: "UK", IN: "IN", MX: "MX", AR: "AR", PT: "PO", ES: "SP", FR: "FR", DE: "GM", JP: "JA", KR: "KS" };

/** Notícias publicadas na última hora em veículos de um país (GDELT, gratuito) */
export async function gdelt(pais: string): Promise<Tendencia[]> {
  const fips = FIPS[pais];
  if (!fips) return [];
  const r = await fetch(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:${fips}&mode=artlist&format=json&maxrecords=25&timespan=1h&sort=datedesc`,
    { headers: { "User-Agent": NAVEGADOR } },
  );
  if (!r.ok) throw new Error(`GDELT ${pais}: HTTP ${r.status}`);
  const d = (await r.json().catch(() => ({}))) as { articles?: { url: string; title: string; domain: string; socialimage?: string; seendate?: string }[] };
  return (d.articles ?? []).map((a) => ({
    fonte: "gdelt",
    pais,
    chave: a.url,
    titulo: a.title,
    url: a.url,
    imagem: a.socialimage || null,
    noticias: [{ titulo: a.title, url: a.url, fonte: a.domain }],
    extra: { autor: a.domain, publicado: a.seendate },
  }));
}

/** Manchetes do país: Google Notícias; se bloquear, GDELT */
export async function noticiasPais(pais: string): Promise<Tendencia[]> {
  try {
    return await googleNoticias(pais);
  } catch {
    return gdelt(pais);
  }
}
