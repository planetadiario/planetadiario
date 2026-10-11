-- Site público: notícias, leitores (login Google), comentários, pontos e assinaturas

-- Notícia no site = Reel publicado
alter table public.reels add column if not exists slug text unique;
alter table public.reels add column if not exists artigo text;
alter table public.reels add column if not exists exclusivo boolean not null default false;
alter table public.reels add column if not exists site_publicado_em timestamptz;
alter table public.reels add column if not exists liberado_em timestamptz;   -- público vê a partir daqui; assinante vê antes
alter table public.reels add column if not exists visualizacoes int not null default 0;
create index if not exists reels_site on public.reels (site_publicado_em desc) where site_publicado_em is not null;

insert into public.config (chave, valor) values
  ('assinatura_preco_centavos', '990'),
  ('acesso_antecipado_min', '30')
on conflict (chave) do nothing;

-- Perfis dos leitores
create table if not exists public.perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text,
  avatar    text,
  pontos    int not null default 0,
  criado_em timestamptz not null default now()
);

create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, avatar)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil();
insert into public.perfis (id, nome) select id, split_part(email, '@', 1) from auth.users on conflict do nothing;

-- Assinaturas (PIX via Lytex, 30 dias por pagamento)
create table if not exists public.assinaturas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  status         text not null default 'pendente' check (status in ('pendente','ativa','cancelada')),
  valor_centavos int not null,
  fatura_id      text unique,
  inicio         timestamptz,
  fim            timestamptz,
  criado_em      timestamptz not null default now()
);
create index if not exists assinaturas_usuario on public.assinaturas (usuario_id, fim desc);

create or replace function public.is_assinante(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and exists (
    select 1 from public.assinaturas where usuario_id = uid and status = 'ativa' and fim > now());
$$;

-- Comentários
create table if not exists public.comentarios (
  id         uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references public.reels(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 1000),
  criado_em  timestamptz not null default now()
);
create index if not exists comentarios_noticia on public.comentarios (noticia_id, criado_em desc);

-- Pontos: +5 por comentário (máx. 10 comentários pontuados por dia)
create or replace function public.pontuar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comentarios
      where usuario_id = new.usuario_id and criado_em > now() - interval '1 day') <= 10 then
    update public.perfis set pontos = pontos + 5 where id = new.usuario_id;
  end if;
  return new;
end $$;
drop trigger if exists ao_comentar on public.comentarios;
create trigger ao_comentar after insert on public.comentarios for each row execute function public.pontuar_comentario();

-- RLS
alter table public.perfis      enable row level security;
alter table public.assinaturas enable row level security;
alter table public.comentarios enable row level security;

create policy perfis_le    on public.perfis for select using (true);
create policy perfis_edita on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy assin_le     on public.assinaturas for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
create policy coment_le    on public.comentarios for select using (true);
create policy coment_cria  on public.comentarios for insert to authenticated with check (usuario_id = auth.uid());
create policy coment_apaga on public.comentarios for delete to authenticated using (usuario_id = auth.uid() or public.is_admin());
-- impede o leitor de mudar os próprios pontos (só triggers/servidor alteram)
create or replace function public.proteger_pontos() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then new.pontos := old.pontos; end if;
  return new;
end $$;
drop trigger if exists protege_pontos on public.perfis;
create trigger protege_pontos before update on public.perfis for each row execute function public.proteger_pontos();

-- Feed público: assinante vê antes (acesso antecipado) e vê conteúdo exclusivo completo
create or replace function public.noticias_site(p_categoria text default null, p_limite int default 24, p_antes timestamptz default null)
returns table (
  id uuid, slug text, categoria text, manchete text, legenda text, artigo text, hashtags text[],
  video_url text, thumb_url text, origem_autor text, exclusivo boolean, bloqueado boolean,
  antecipado boolean, site_publicado_em timestamptz, visualizacoes int, comentarios bigint
)
language sql stable security definer set search_path = public as $$
  with a as (select public.is_assinante() as ok)
  select r.id, r.slug, r.categoria, r.manchete,
         case when r.exclusivo and not a.ok then null else r.legenda end,
         case when r.exclusivo and not a.ok then null else r.artigo end,
         r.hashtags,
         case when r.exclusivo and not a.ok then null else r.video_url end,
         r.thumb_url, r.origem_autor, r.exclusivo, (r.exclusivo and not a.ok),
         (r.liberado_em > now()), r.site_publicado_em, r.visualizacoes,
         (select count(*) from public.comentarios c where c.noticia_id = r.id)
  from public.reels r, a
  where r.site_publicado_em is not null
    and (r.liberado_em <= now() or a.ok)
    and (p_categoria is null or r.categoria = p_categoria)
    and (p_antes is null or r.site_publicado_em < p_antes)
  order by r.site_publicado_em desc
  limit least(p_limite, 60);
$$;


create or replace function public.ler_noticia(p_slug text)
returns table (
  id uuid, slug text, categoria text, manchete text, legenda text, artigo text, hashtags text[],
  video_url text, thumb_url text, origem_autor text, exclusivo boolean, bloqueado boolean,
  antecipado boolean, site_publicado_em timestamptz, visualizacoes int, fb_post_url text, ig_post_url text
)
language plpgsql security definer set search_path = public as $$
declare ok boolean := public.is_assinante();
begin
  update public.reels set visualizacoes = visualizacoes + 1 where reels.slug = p_slug and site_publicado_em is not null;
  return query
  select r.id, r.slug, r.categoria, r.manchete,
         case when r.exclusivo and not ok then null else r.legenda end,
         case when r.exclusivo and not ok then null else r.artigo end,
         r.hashtags,
         case when r.exclusivo and not ok then null else r.video_url end,
         r.thumb_url, r.origem_autor, r.exclusivo, (r.exclusivo and not ok),
         (r.liberado_em > now()), r.site_publicado_em, r.visualizacoes, r.fb_post_url, r.ig_post_url
  from public.reels r
  where r.slug = p_slug and r.site_publicado_em is not null and (r.liberado_em <= now() or ok);
end $$;

create or replace function public.ranking_leitores(p_limite int default 10)
returns table (nome text, avatar text, pontos int, assinante boolean)
language sql stable security definer set search_path = public as $$
  select p.nome, p.avatar, p.pontos, public.is_assinante(p.id)
  from public.perfis p where p.pontos > 0 order by p.pontos desc limit least(p_limite, 50);
$$;

-- comentários com nome/avatar/selo de assinante
create or replace function public.comentarios_noticia(p_noticia uuid)
returns table (id uuid, texto text, criado_em timestamptz, usuario_id uuid, nome text, avatar text, assinante boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.texto, c.criado_em, c.usuario_id, p.nome, p.avatar, public.is_assinante(c.usuario_id)
  from public.comentarios c left join public.perfis p on p.id = c.usuario_id
  where c.noticia_id = p_noticia order by c.criado_em desc limit 200;
$$;

grant execute on function public.noticias_site, public.ler_noticia, public.ranking_leitores,
  public.comentarios_noticia, public.is_assinante to anon, authenticated;

alter publication supabase_realtime add table public.comentarios;
