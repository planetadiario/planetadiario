-- Planeta Diário — esquema inicial

create extension if not exists pgcrypto;

-- Quem pode acessar o painel
create table public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;

-- Categorias (uma faixa/molde por categoria)
create table public.categorias (
  slug  text primary key,
  label text not null,
  nome  text not null,
  cor   text not null default '#FF0000',
  ativa boolean not null default true,
  ordem int not null default 0
);

-- Assuntos em alta detectados pelos coletores
create table public.tendencias (
  id            uuid primary key default gen_random_uuid(),
  fonte         text not null,              -- google_trends | youtube | reddit | google_news
  pais          text,                       -- BR, US, GB...
  chave         text not null,              -- id externo (para não duplicar)
  titulo        text not null,
  titulo_pt     text,
  resumo        text,
  url           text,
  imagem        text,
  video_url     text,                       -- quando a fonte já é um vídeo
  trafego       bigint,
  score         int not null default 0,     -- 0–100: potencial viral
  categoria     text references public.categorias(slug),
  noticias      jsonb,
  extra         jsonb,
  analisado     boolean not null default false,
  detectado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (fonte, chave)
);
create index tendencias_recentes on public.tendencias (detectado_em desc);
create index tendencias_score on public.tendencias (score desc);

-- Reels produzidos
create table public.reels (
  id                uuid primary key default gen_random_uuid(),
  tendencia_id      uuid references public.tendencias(id) on delete set null,
  origem_url        text not null,
  origem_plataforma text,
  origem_autor      text,
  origem_titulo     text,
  categoria         text not null default 'noticias' references public.categorias(slug),
  status            text not null default 'na_fila'
                    check (status in ('na_fila','processando','pronto','publicando','publicado','erro','rejeitado')),
  manchete          text,
  legenda           text,
  hashtags          text[] not null default '{}',
  video_path        text,
  video_url         text,
  thumb_url         text,
  duracao           numeric,
  corte_inicio      numeric,
  corte_fim         numeric,
  fb_video_id       text,
  fb_post_url       text,
  agendado_para     timestamptz,
  publicado_em      timestamptz,
  erro              text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index reels_status on public.reels (status, criado_em desc);

-- Configurações chave/valor
create table public.config (
  chave text primary key,
  valor jsonb not null
);

create or replace function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
create trigger reels_atualizado before update on public.reels
  for each row execute function public.tocar_atualizado();
create trigger tendencias_atualizado before update on public.tendencias
  for each row execute function public.tocar_atualizado();

-- RLS: só admins pelo painel; worker e pipeline usam service_role (ignora RLS)
alter table public.admins     enable row level security;
alter table public.categorias enable row level security;
alter table public.tendencias enable row level security;
alter table public.reels      enable row level security;
alter table public.config     enable row level security;

create policy admin_all on public.categorias for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.tendencias for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.reels      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.config     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_le  on public.admins     for select to authenticated using (public.is_admin());

-- Tempo real no painel
alter publication supabase_realtime add table public.reels, public.tendencias;

-- Storage: vídeos prontos (público para o Facebook conseguir baixar)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', true, 524288000, array['video/mp4','image/jpeg'])
on conflict (id) do nothing;

-- Dados iniciais
insert into public.config (chave, valor) values
  ('publicacao_automatica', 'false'),
  ('score_minimo_auto', '80'),
  ('max_posts_dia', '12'),
  ('paises', '["BR","US","GB","IN","MX","AR","PT","ES","FR","DE","JP","KR"]'),
  ('fontes_bloqueadas', '["globo","g1","record","sbt","band","cnn brasil","jovem pan"]'),
  ('subreddits', '["videos","nextfuckinglevel","interestingasfuck","Damnthatsinteresting","PublicFreakout","BeAmazed","aww","NatureIsFuckingLit","oddlysatisfying","Unexpected","sports","worldnews"]');

insert into public.categorias (slug, label, nome, ordem) values
  ('noticias','NOTÍCIAS','Notícias do Brasil',1),
  ('urgente','URGENTE','Urgente / Última hora',2),
  ('mundo','MUNDO','Mundo / Internacional',3),
  ('esportes','ESPORTES','Esportes',4),
  ('famosos','FAMOSOS','Famosos e Entretenimento',5),
  ('curiosidades','CURIOSIDADES','Curiosidades',6),
  ('viral','VIRAL','Viral / Inacreditável',7),
  ('emocionante','EMOCIONANTE','Histórias emocionantes',8),
  ('humor','HUMOR','Humor',9),
  ('animais','ANIMAIS','Animais',10),
  ('natureza','NATUREZA','Natureza, clima e desastres',11),
  ('ciencia','CIÊNCIA','Ciência e Espaço',12),
  ('tecnologia','TECNOLOGIA','Tecnologia e IA',13),
  ('saude','SAÚDE','Saúde e Bem-estar',14),
  ('economia','ECONOMIA','Economia e Dinheiro',15),
  ('policia','POLÍCIA','Polícia e Segurança',16);

insert into public.admins (email) values ('ceo.planetadiario@gmail.com');
