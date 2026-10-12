-- notícias mais lidas dos últimos 7 dias (respeita acesso antecipado)
create or replace function public.mais_lidas(p_limite int default 5)
returns table (slug text, manchete text, thumb_url text, categoria text, visualizacoes int)
language sql stable security definer set search_path = public as $$
  select r.slug, r.manchete, r.thumb_url, r.categoria, r.visualizacoes
  from public.reels r
  where r.site_publicado_em > now() - interval '7 days'
    and (r.liberado_em <= now() or public.is_assinante())
  order by r.visualizacoes desc, r.site_publicado_em desc
  limit least(p_limite, 20);
$$;
grant execute on function public.mais_lidas to anon, authenticated;
