-- Metas de monetização e constância de publicação

-- seguidores por dia (Facebook e Instagram)
create table if not exists public.seguidores_historico (
  dia date primary key,
  fb  int,
  ig  int,
  atualizado_em timestamptz not null default now()
);
alter table public.seguidores_historico enable row level security;
drop policy if exists seg_admin on public.seguidores_historico;
create policy seg_admin on public.seguidores_historico for select to authenticated using ((select public.is_admin()));

insert into public.config (chave, valor) values
  -- metas de referência (confira as exatas no Painel Profissional do Facebook)
  ('metas_monetizacao', '{"seguidores": 5000, "minutos_60d": 60000, "reels_30d": 5}'),
  -- horários de pico (Brasília) em que o piloto automático publica
  ('horarios_pico', '[[7, 9], [11, 14], [17, 23]]'),
  -- meta mínima de posts por dia: se estiver atrasado, a nota mínima baixa um pouco
  ('meta_posts_dia', '8')
on conflict (chave) do nothing;

update public.config set valor = '15' where chave = 'max_posts_dia' and valor::text = '12';
update public.config set valor = '30' where chave = 'intervalo_min_minutos';
insert into public.config (chave, valor) values ('intervalo_min_minutos', '30') on conflict (chave) do nothing;
update public.config set valor = '75' where chave = 'score_minimo_auto' and valor::text = '80';
