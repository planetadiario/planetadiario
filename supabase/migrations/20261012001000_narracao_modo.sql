-- narração por Reel: auto (IA decide), sim ou nao
alter table public.reels add column if not exists narracao_modo text not null default 'auto' check (narracao_modo in ('auto','sim','nao'));
