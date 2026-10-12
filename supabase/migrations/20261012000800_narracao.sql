alter table public.reels add column if not exists narracao text;
insert into public.config (chave, valor) values ('narracao', '{"ativa": false, "voz": "cadu"}') on conflict (chave) do nothing;
