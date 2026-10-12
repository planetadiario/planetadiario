-- Bot do Telegram: compra do Pro e do Clube de Fundadores por PIX dentro do Telegram,
-- alertas antecipados para quem é Pro no bot e código para ativar no site.

create table if not exists public.bot_usuarios (
  chat_id       bigint primary key,
  nome          text,
  username      text,
  estado        text,          -- passo da conversa (ex.: aguardando o CPF)
  pro_ate       timestamptz,   -- recebe as notícias antes enquanto for Pro
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.bot_compras (
  id             uuid primary key default gen_random_uuid(),
  chat_id        bigint not null references public.bot_usuarios(chat_id) on delete cascade,
  tipo           text not null check (tipo in ('pro', 'fundador')),
  valor_centavos int not null,
  fatura_id      text unique,
  status         text not null default 'pendente' check (status in ('pendente', 'pago')),
  codigo         text unique,
  pago_em        timestamptz,
  resgatado_por  uuid references auth.users(id) on delete set null,
  resgatado_em   timestamptz,
  criado_em      timestamptz not null default now()
);

-- só o worker (service role) acessa
alter table public.bot_usuarios enable row level security;
alter table public.bot_compras enable row level security;
revoke all on public.bot_usuarios, public.bot_compras from anon, authenticated;

alter table public.reels add column if not exists bot_alertado boolean not null default false;

-- resgata no site o código recebido no bot (Pro de 30 dias ou número de fundador)
create or replace function public.resgatar_codigo(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.bot_compras;
  fid uuid;
  n int;
  fim_atual timestamptz;
begin
  if uid is null then raise exception 'Entre com o Google para resgatar' using errcode = 'P0001'; end if;
  select * into c from public.bot_compras
   where codigo = upper(trim(p_codigo)) and status = 'pago' and resgatado_por is null
   for update;
  if not found then raise exception 'Código inválido ou já usado' using errcode = 'P0001'; end if;

  if c.tipo = 'pro' then
    select max(fim) into fim_atual from public.assinaturas where usuario_id = uid and status = 'ativa';
    insert into public.assinaturas (usuario_id, status, valor_centavos, inicio, fim)
    values (uid, 'ativa', c.valor_centavos, now(), greatest(now(), coalesce(fim_atual, now())) + interval '30 days');
    update public.perfis set pontos = pontos + 100 where id = uid;
  else
    if exists (select 1 from public.fundadores where usuario_id = uid and status = 'ativo') then
      raise exception 'Esta conta já é fundadora' using errcode = 'P0001';
    end if;
    insert into public.fundadores (usuario_id, valor_centavos) values (uid, c.valor_centavos) returning id into fid;
    n := public.ativar_fundador(fid);
  end if;

  update public.bot_compras set resgatado_por = uid, resgatado_em = now() where id = c.id;
  return jsonb_build_object('tipo', c.tipo, 'numero', n);
end $$;
revoke all on function public.resgatar_codigo(text) from public, anon;
grant execute on function public.resgatar_codigo(text) to authenticated;
