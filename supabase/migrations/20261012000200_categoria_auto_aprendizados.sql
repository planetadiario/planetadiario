-- a IA confirma a categoria quando ela não foi escolhida a dedo
alter table public.reels add column if not exists categoria_auto boolean not null default true;
-- aprendizados gerados pela IA a partir do desempenho dos Reels
insert into public.config (chave, valor) values ('aprendizados', '{"texto": "", "atualizado_em": null}')
on conflict (chave) do nothing;
