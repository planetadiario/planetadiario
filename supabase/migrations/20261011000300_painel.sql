-- Moldes enviados pelo painel + métricas dos posts + rodapé do Reel
alter table public.categorias add column if not exists molde_url text;
alter table public.reels add column if not exists metricas jsonb;
alter table public.reels add column if not exists metricas_em timestamptz;

insert into public.config (chave, valor) values ('rodape', '"Mais notícias em planetadiario.online"')
on conflict (chave) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moldes', 'moldes', true, 10485760, array['image/png'])
on conflict (id) do nothing;

create policy moldes_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moldes' and public.is_admin());
create policy moldes_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'moldes' and public.is_admin());
create policy moldes_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moldes' and public.is_admin());
create policy moldes_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'moldes' and public.is_admin());
