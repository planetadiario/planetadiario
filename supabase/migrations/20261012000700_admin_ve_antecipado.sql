-- admins veem as notícias na hora (como assinantes), inclusive no acesso antecipado
create or replace function public.pode_ver_antecipado() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_assinante(auth.uid()) or public.is_admin();
$$;
revoke execute on function public.pode_ver_antecipado() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buscar_noticias(p_q text, p_limite integer DEFAULT 30)
 RETURNS TABLE(slug text, manchete text, thumb_url text, categoria text, site_publicado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with q as (select left(btrim(coalesce(p_q, '')), 100) as t)
  select r.slug, r.manchete, r.thumb_url, r.categoria, r.site_publicado_em
  from public.reels r, q
  where length(q.t) >= 2
    and r.site_publicado_em is not null
    and (r.liberado_em <= now() or public.pode_ver_antecipado())
    and (r.manchete ilike '%' || q.t || '%' or r.legenda ilike '%' || q.t || '%' or array_to_string(r.hashtags, ' ') ilike '%' || q.t || '%')
  order by r.site_publicado_em desc
  limit least(p_limite, 60);
$function$
;

CREATE OR REPLACE FUNCTION public.ler_noticia(p_slug text)
 RETURNS TABLE(id uuid, slug text, categoria text, manchete text, legenda text, artigo text, hashtags text[], video_url text, thumb_url text, origem_autor text, exclusivo boolean, bloqueado boolean, antecipado boolean, site_publicado_em timestamp with time zone, visualizacoes integer, fb_post_url text, ig_post_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare ok boolean := public.pode_ver_antecipado();
begin
  update public.reels r set visualizacoes = r.visualizacoes + 1 where r.slug = p_slug and r.site_publicado_em is not null;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.mais_lidas(p_limite integer DEFAULT 5)
 RETURNS TABLE(slug text, manchete text, thumb_url text, categoria text, visualizacoes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.slug, r.manchete, r.thumb_url, r.categoria, r.visualizacoes
  from public.reels r
  where r.site_publicado_em > now() - interval '7 days'
    and (r.liberado_em <= now() or public.pode_ver_antecipado())
  order by r.visualizacoes desc, r.site_publicado_em desc
  limit least(p_limite, 20);
$function$
;

CREATE OR REPLACE FUNCTION public.noticias_site(p_categoria text DEFAULT NULL::text, p_limite integer DEFAULT 24, p_antes timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, slug text, categoria text, manchete text, legenda text, artigo text, hashtags text[], video_url text, thumb_url text, origem_autor text, exclusivo boolean, bloqueado boolean, antecipado boolean, site_publicado_em timestamp with time zone, visualizacoes integer, comentarios bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with a as (select public.pode_ver_antecipado() as ok)
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
$function$
;
