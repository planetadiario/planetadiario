alter table public.tendencias add column if not exists usado boolean not null default false;
create index if not exists tendencias_usado on public.tendencias (usado, score desc);
