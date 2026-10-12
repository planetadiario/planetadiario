-- story no Facebook junto com cada Reel + metas do plano semanal (editáveis no painel)
alter table public.reels add column if not exists fb_story_id text;

insert into public.config (chave, valor) values
  ('metas_semanais', '{"posts_fb": 40, "posts_ig": 40, "stories_fb": 7, "views_fb": 2000, "views_ig": 30000, "seguidores": 100}')
on conflict (chave) do nothing;
