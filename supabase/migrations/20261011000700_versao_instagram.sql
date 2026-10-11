-- versão do Reel e do molde com layout na área segura do Instagram
alter table public.reels add column if not exists video_ig_url text;
alter table public.categorias add column if not exists molde_ig_url text;
