export interface Bindings {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SITE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  IA_MODELO: string;
  NVIDIA_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  FB_PAGE_ID: string;
  FB_PAGE_TOKEN: string;
  FB_GRAPH_VERSION: string;
  YOUTUBE_API_KEY?: string;
  INTERNAL_SECRET: string;
  LYTEX_CLIENT_ID: string;
  LYTEX_CLIENT_SECRET: string;
  LYTEX_CALLBACK_SECRET?: string;
  BLUESKY_USUARIO?: string;
  BLUESKY_SENHA_APP?: string;
  // redes extras (opcionais: sem a credencial, a rede fica desligada)
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CANAL?: string;
  THREADS_APP_ID?: string;
  THREADS_APP_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
}

export interface Tendencia {
  id?: string;
  fonte: string;
  pais: string | null;
  chave: string;
  titulo: string;
  titulo_pt?: string | null;
  resumo?: string | null;
  url?: string | null;
  imagem?: string | null;
  video_url?: string | null;
  trafego?: number | null;
  score?: number;
  categoria?: string | null;
  noticias?: unknown;
  extra?: Record<string, unknown> | null;
  analisado?: boolean;
  usado?: boolean;
  detectado_em?: string;
}
