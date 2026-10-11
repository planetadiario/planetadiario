-- corrige ambiguidade entre a coluna e o parâmetro de saída "visualizacoes"
create or replace function public.ler_noticia(p_slug text)
returns table (
  id uuid, slug text, categoria text, manchete text, legenda text, artigo text, hashtags text[],
  video_url text, thumb_url text, origem_autor text, exclusivo boolean, bloqueado boolean,
  antecipado boolean, site_publicado_em timestamptz, visualizacoes int, fb_post_url text, ig_post_url text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare ok boolean := public.is_assinante();
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
end $$;
