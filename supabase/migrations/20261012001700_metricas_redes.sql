-- métricas e metas de monetização por rede
alter table public.seguidores_historico
  add column if not exists yt int,
  add column if not exists tg int,
  add column if not exists threads int,
  add column if not exists tt int;

insert into public.config (chave, valor) values ('metas_redes', '{
  "facebook":  {"seguidores": 5000, "minutos_60d": 60000},
  "instagram": {"seguidores": 10000, "views_30d": 1000000},
  "youtube":   {"inscritos": 1000, "views_90d": 10000000},
  "tiktok":    {"seguidores": 10000, "views_30d": 100000},
  "telegram":  {"inscritos": 1000},
  "threads":   {"seguidores": 1000}
}') on conflict (chave) do nothing;
