import { supabase } from "./supabase";

export interface Tendencia {
  id: string;
  fonte: string;
  pais: string | null;
  titulo: string;
  titulo_pt: string | null;
  resumo: string | null;
  url: string | null;
  imagem: string | null;
  video_url: string | null;
  trafego: number | null;
  score: number;
  categoria: string | null;
  noticias: { titulo?: string; url?: string; fonte?: string }[] | null;
  extra: { autor?: string; duracao?: number; busca?: string; publicado?: string } | null;
  analisado: boolean;
  usado: boolean;
  detectado_em: string;
}

export interface Reel {
  id: string;
  tendencia_id: string | null;
  origem_url: string;
  origem_autor: string | null;
  origem_titulo: string | null;
  categoria: string;
  status: "na_fila" | "processando" | "pronto" | "publicando" | "publicado" | "erro" | "rejeitado";
  manchete: string | null;
  legenda: string | null;
  hashtags: string[];
  video_url: string | null;
  thumb_url: string | null;
  duracao: number | null;
  fb_post_url: string | null;
  ig_post_url: string | null;
  slug: string | null;
  liberado_em: string | null;
  publicado_em: string | null;
  erro: string | null;
  criado_em: string;
}

export interface Categoria {
  slug: string;
  label: string;
  nome: string;
  ativa: boolean;
  ordem: number;
}

export interface VideoEncontrado {
  fonte: string;
  titulo: string;
  url: string;
  video_url: string;
  imagem: string | null;
  trafego: number | null;
  extra: { autor?: string; duracao?: number; publicado?: string };
}

/** Chama a API do worker com o token da sessão */
export async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/api${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      ...init.headers,
    },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
  return corpo as T;
}

export const BANDEIRA: Record<string, string> = {
  BR: "🇧🇷", US: "🇺🇸", GB: "🇬🇧", IN: "🇮🇳", MX: "🇲🇽", AR: "🇦🇷", PT: "🇵🇹", ES: "🇪🇸",
  FR: "🇫🇷", DE: "🇩🇪", JP: "🇯🇵", KR: "🇰🇷", IT: "🇮🇹", CA: "🇨🇦", AU: "🇦🇺",
};

export const FONTE: Record<string, string> = {
  google_trends: "Google Trends",
  youtube: "YouTube",
  dailymotion: "Dailymotion",
  telegram: "Telegram",
  google_news: "Google Notícias",
  gdelt: "GDELT",
  bluesky: "Bluesky",
  manual: "Manual",
};

export function tempoAtras(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function numeroCurto(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".0", "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(".0", "")}K`;
  return String(n);
}
