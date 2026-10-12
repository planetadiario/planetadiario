-- funções internas (triggers e checagens) não ficam expostas na API pública
revoke execute on function public.criar_perfil(), public.limitar_assinaturas(), public.limitar_comentarios(),
  public.pontuar_comentario(), public.proteger_pontos(), public.tocar_atualizado() from public, anon, authenticated;
revoke execute on function public.is_assinante(uuid) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.alternar_curtida(uuid) from public, anon;

alter function public.tocar_atualizado() set search_path = public;
alter function public.proteger_pontos() set search_path = public;

-- políticas avaliando auth.uid() uma vez por consulta (desempenho)
drop policy if exists perfis_edita on public.perfis;
create policy perfis_edita on public.perfis for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists assin_le on public.assinaturas;
create policy assin_le on public.assinaturas for select to authenticated using (usuario_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists coment_cria on public.comentarios;
create policy coment_cria on public.comentarios for insert to authenticated with check (usuario_id = (select auth.uid()));
drop policy if exists coment_apaga on public.comentarios;
create policy coment_apaga on public.comentarios for delete to authenticated using (usuario_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists curtidas_le on public.curtidas;
create policy curtidas_le on public.curtidas for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists curtidas_cria on public.curtidas;
create policy curtidas_cria on public.curtidas for insert to authenticated with check (usuario_id = (select auth.uid()));
drop policy if exists curtidas_apaga on public.curtidas;
create policy curtidas_apaga on public.curtidas for delete to authenticated using (usuario_id = (select auth.uid()));
