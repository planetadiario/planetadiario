-- Facebook com fila e ritmo próprios (o antispam limita páginas novas)
alter table public.reels add column if not exists fb_publicado_em timestamptz;
update public.reels set fb_publicado_em = publicado_em where fb_video_id is not null and fb_publicado_em is null;

insert into public.config (chave, valor) values
  ('fb_intervalo_min', '60'),
  ('fb_story', 'false')
on conflict (chave) do nothing;
