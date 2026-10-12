-- Telegram, Threads, YouTube Shorts e TikTok
alter table public.reels
  add column if not exists tg_msg_id text,
  add column if not exists tg_url text,
  add column if not exists threads_id text,
  add column if not exists threads_url text,
  add column if not exists yt_id text,
  add column if not exists yt_url text,
  add column if not exists tt_id text,
  add column if not exists tt_url text,
  add column if not exists redes_erro jsonb;

-- tokens de OAuth: só a service role (worker) lê e grava
create table if not exists public.integracoes (
  rede text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.integracoes enable row level security;
revoke all on public.integracoes from anon, authenticated;

insert into public.config (chave, valor) values
  ('redes', '{"telegram": true, "threads": true, "youtube": true, "tiktok": true, "youtube_max_dia": 6}')
on conflict (chave) do nothing;
