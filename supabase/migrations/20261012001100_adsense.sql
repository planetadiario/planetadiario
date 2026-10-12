-- Google AdSense: código do editor e blocos de anúncio (vazio = sem anúncios)
insert into public.config (chave, valor) values ('adsense', '{"client": "", "slot_home": "", "slot_artigo": ""}')
on conflict (chave) do nothing;

create or replace function public.adsense_publico() returns jsonb
language sql stable security definer set search_path = public as $$
  select valor from public.config where chave = 'adsense';
$$;
grant execute on function public.adsense_publico() to anon, authenticated;
