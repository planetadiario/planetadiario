-- corrige o agrupamento por dia do painel de audiência
-- resumo para o painel (só administradores)
create or replace function public.painel_audiencia(p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := now() - make_interval(days => p_dias); r jsonb;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  select jsonb_build_object(
    'visitas_hoje', (select count(*) from visitas where criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'visitantes_hoje', (select count(distinct visitante) from visitas where criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'visitas', (select count(*) from visitas where criado_em >= desde),
    'visitantes', (select count(distinct visitante) from visitas where criado_em >= desde),
    'online', (select count(distinct visitante) from visitas where criado_em >= now() - interval '5 minutes'),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'visitas', n, 'visitantes', u) order by dia) from (
        select (criado_em at time zone 'America/Sao_Paulo')::date dia, count(*) n, count(distinct visitante) u
        from visitas where criado_em >= desde group by 1) d), '[]'),
    'origens', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('origem', coalesce(origem, 'direto'), 'visitas', count(*)) x
        from visitas where criado_em >= desde group by coalesce(origem, 'direto') order by count(*) desc limit 10) o), '[]'),
    'dispositivos', coalesce((select jsonb_object_agg(coalesce(dispositivo, '?'), n) from (
        select dispositivo, count(*) n from visitas where criado_em >= desde group by dispositivo) d), '{}'),
    'paginas', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('caminho', v.caminho, 'visitas', count(*), 'titulo', max(r.manchete)) x
        from visitas v left join reels r on v.caminho = '/n/' || r.slug
        where v.criado_em >= desde group by v.caminho order by count(*) desc limit 10) p), '[]'),
    'cadastros_total', (select count(*) from perfis),
    'cadastros_periodo', (select count(*) from perfis where criado_em >= desde),
    'cadastros_hoje', (select count(*) from perfis where criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'cadastros_por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'n', n) order by dia) from (
        select (criado_em at time zone 'America/Sao_Paulo')::date dia, count(*) n
        from perfis where criado_em >= desde group by 1) c), '[]'),
    'assinantes', (select count(distinct usuario_id) from assinaturas where status = 'ativa' and fim > now()),
    'fundadores', (select count(*) from fundadores where status = 'ativo'),
    'bot_usuarios', (select count(*) from bot_usuarios),
    'bot_pro', (select count(*) from bot_usuarios where pro_ate > now()),
    'recentes', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object(
          'nome', p.nome, 'avatar', p.avatar, 'email', u.email, 'criado_em', p.criado_em, 'pontos', p.pontos,
          'ultimo_acesso', u.last_sign_in_at,
          'assinante', exists (select 1 from assinaturas a where a.usuario_id = p.id and a.status = 'ativa' and a.fim > now()),
          'fundador', (select f.numero from fundadores f where f.usuario_id = p.id and f.status = 'ativo'),
          'comentarios', (select count(*) from comentarios c where c.usuario_id = p.id)) x
        from perfis p join auth.users u on u.id = p.id
        order by p.criado_em desc limit 30) l), '[]')
  ) into r;
  return r;
end $$;
revoke all on function public.painel_audiencia(int) from public, anon;
grant execute on function public.painel_audiencia(int) to authenticated;
