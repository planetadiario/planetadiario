-- Curtidas, compartilhamentos e busca de notícias no site
create table if not exists public.curtidas (
  noticia_id uuid not null references public.reels(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (noticia_id, usuario_id)
);
alter table public.curtidas enable row level security;
create policy curtidas_le    on public.curtidas for select using (true);
create policy curtidas_cria  on public.curtidas for insert to authenticated with check (usuario_id = auth.uid());
create policy curtidas_apaga on public.curtidas for delete to authenticated using (usuario_id = auth.uid());

alter table public.reels add column if not exists compartilhamentos int not null default 0;

-- contadores de várias notícias de uma vez (+ se o leitor atual curtiu)
create or replace function public.interacoes(p_ids uuid[])
returns table (id uuid, curtidas bigint, comentarios bigint, compartilhamentos int, curti boolean)
language sql stable security definer set search_path = public as $$
  select r.id,
         (select count(*) from public.curtidas c where c.noticia_id = r.id),
         (select count(*) from public.comentarios c where c.noticia_id = r.id),
         r.compartilhamentos,
         exists (select 1 from public.curtidas c where c.noticia_id = r.id and c.usuario_id = auth.uid())
  from public.reels r where r.id = any(p_ids) and r.site_publicado_em is not null;
$$;

create or replace function public.alternar_curtida(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if exists (select 1 from public.curtidas where noticia_id = p_id and usuario_id = auth.uid()) then
    delete from public.curtidas where noticia_id = p_id and usuario_id = auth.uid();
    return false;
  end if;
  insert into public.curtidas (noticia_id, usuario_id) values (p_id, auth.uid());
  return true;
end $$;

create or replace function public.registrar_compartilhamento(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.reels set compartilhamentos = compartilhamentos + 1 where id = p_id and site_publicado_em is not null;
$$;

-- busca por manchete/legenda (respeita acesso antecipado)
create or replace function public.buscar_noticias(p_q text, p_limite int default 30)
returns table (slug text, manchete text, thumb_url text, categoria text, site_publicado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select r.slug, r.manchete, r.thumb_url, r.categoria, r.site_publicado_em
  from public.reels r
  where r.site_publicado_em is not null
    and (r.liberado_em <= now() or public.is_assinante())
    and (r.manchete ilike '%' || p_q || '%' or r.legenda ilike '%' || p_q || '%' or array_to_string(r.hashtags, ' ') ilike '%' || p_q || '%')
  order by r.site_publicado_em desc
  limit least(p_limite, 60);
$$;

grant execute on function public.interacoes, public.alternar_curtida, public.registrar_compartilhamento, public.buscar_noticias to anon, authenticated;
