-- Clube de Fundadores: pagamento único, número eterno, selo por ordem de chegada, mural e votação de pautas.
-- Não é participação societária.
insert into public.config (chave, valor) values
  ('fundador_preco_centavos', '1590'),
  ('fundador_meta', '63000'),
  ('fundador_dias_pro', '30')
on conflict (chave) do nothing;

create table if not exists public.fundadores (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  status         text not null default 'pendente' check (status in ('pendente','ativo','cancelado')),
  numero         int unique,
  valor_centavos int not null,
  fatura_id      text unique,
  nome_mural     text,
  mostrar_mural  boolean not null default true,
  criado_em      timestamptz not null default now(),
  pago_em        timestamptz
);
create unique index if not exists fundador_unico_ativo on public.fundadores (usuario_id) where status = 'ativo';
create sequence if not exists public.fundador_numero;

create or replace function public.selo_fundador(n int) returns text language sql immutable set search_path = public as $$
  select case when n is null then null when n <= 1000 then 'pioneiro' when n <= 10000 then 'fundador' else 'apoiador' end;
$$;

-- ativa o fundador: número sequencial, +500 pontos e dias de Pro grátis (idempotente)
create or replace function public.ativar_fundador(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare f public.fundadores; n int; dias int;
begin
  select * into f from public.fundadores where id = p_id for update;
  if f.status = 'ativo' then return f.numero; end if;
  n := nextval('public.fundador_numero');
  update public.fundadores set status = 'ativo', numero = n, pago_em = now() where id = p_id;
  update public.perfis set pontos = pontos + 500 where id = f.usuario_id;
  select coalesce((valor #>> '{}')::int, 30) into dias from public.config where chave = 'fundador_dias_pro';
  if dias > 0 then
    insert into public.assinaturas (usuario_id, status, valor_centavos, inicio, fim)
    values (f.usuario_id, 'ativa', 0, now(),
            greatest(now(), coalesce((select max(fim) from public.assinaturas where usuario_id = f.usuario_id and status = 'ativa'), now())) + make_interval(days => dias));
  end if;
  return n;
end $$;
revoke execute on function public.ativar_fundador(uuid) from public, anon, authenticated;

-- anti-abuso: um fundador por pessoa e no máximo 3 cobranças pendentes por hora
create or replace function public.limitar_fundadores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.fundadores where usuario_id = new.usuario_id and status = 'ativo') then
    raise exception 'Você já é fundador do Planeta Diário.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.fundadores where usuario_id = new.usuario_id and status = 'pendente' and criado_em > now() - interval '1 hour') >= 3 then
    raise exception 'Muitas tentativas de pagamento. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.limitar_fundadores() from public, anon, authenticated;
drop trigger if exists limita_fundadores on public.fundadores;
create trigger limita_fundadores before insert on public.fundadores for each row execute function public.limitar_fundadores();

alter table public.fundadores enable row level security;
drop policy if exists fundador_le on public.fundadores;
create policy fundador_le on public.fundadores for select to authenticated using (usuario_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists fundador_mural on public.fundadores;
create policy fundador_mural on public.fundadores for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- o leitor só pode mudar o nome e a visibilidade no mural
create or replace function public.proteger_fundador() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.status := old.status;
    new.numero := old.numero;
    new.valor_centavos := old.valor_centavos;
    new.fatura_id := old.fatura_id;
    new.pago_em := old.pago_em;
    new.usuario_id := old.usuario_id;
    new.nome_mural := left(btrim(new.nome_mural), 40);
  end if;
  return new;
end $$;
revoke execute on function public.proteger_fundador() from public, anon, authenticated;
drop trigger if exists protege_fundador on public.fundadores;
create trigger protege_fundador before update on public.fundadores for each row execute function public.proteger_fundador();

-- números públicos do clube
create or replace function public.clube_fundadores()
returns table (total bigint, meta int, preco_centavos int, dias_pro int, ultimo_numero int)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.fundadores where status = 'ativo'),
         (select (valor #>> '{}')::int from public.config where chave = 'fundador_meta'),
         (select (valor #>> '{}')::int from public.config where chave = 'fundador_preco_centavos'),
         (select (valor #>> '{}')::int from public.config where chave = 'fundador_dias_pro'),
         (select max(numero) from public.fundadores where status = 'ativo');
$$;

create or replace function public.mural_fundadores(p_limite int default 200, p_depois int default 0)
returns table (numero int, nome text, avatar text, selo text)
language sql stable security definer set search_path = public as $$
  select f.numero, coalesce(nullif(f.nome_mural, ''), p.nome, 'Fundador'), p.avatar, public.selo_fundador(f.numero)
  from public.fundadores f left join public.perfis p on p.id = f.usuario_id
  where f.status = 'ativo' and f.mostrar_mural and f.numero > p_depois
  order by f.numero limit least(p_limite, 500);
$$;

-- selo de fundador nos comentários
drop function if exists public.comentarios_noticia(uuid);
create function public.comentarios_noticia(p_noticia uuid)
returns table (id uuid, texto text, criado_em timestamptz, usuario_id uuid, nome text, avatar text, assinante boolean, fundador int, selo text)
language sql stable security definer set search_path = public as $$
  select c.id, c.texto, c.criado_em, c.usuario_id, p.nome, p.avatar, public.is_assinante(c.usuario_id), f.numero, public.selo_fundador(f.numero)
  from public.comentarios c
  left join public.perfis p on p.id = c.usuario_id
  left join public.fundadores f on f.usuario_id = c.usuario_id and f.status = 'ativo'
  where c.noticia_id = p_noticia order by c.criado_em desc limit 200;
$$;

-- Votação de pautas (só fundadores votam)
create table if not exists public.enquetes (
  id        uuid primary key default gen_random_uuid(),
  pergunta  text not null check (char_length(pergunta) between 5 and 200),
  opcoes    text[] not null check (array_length(opcoes, 1) between 2 and 6),
  aberta    boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.votos (
  enquete_id uuid not null references public.enquetes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  opcao      int not null,
  criado_em  timestamptz not null default now(),
  primary key (enquete_id, usuario_id)
);
alter table public.enquetes enable row level security;
alter table public.votos enable row level security;
drop policy if exists enquetes_le on public.enquetes;
create policy enquetes_le on public.enquetes for select using (true);
drop policy if exists enquetes_admin on public.enquetes;
create policy enquetes_admin on public.enquetes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists votos_le on public.votos;
create policy votos_le on public.votos for select to authenticated using (usuario_id = (select auth.uid()));

create or replace function public.votar(p_enquete uuid, p_opcao int) returns void
language plpgsql security definer set search_path = public as $$
declare e public.enquetes;
begin
  if auth.uid() is null then raise exception 'Entre para votar.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.fundadores where usuario_id = auth.uid() and status = 'ativo') then
    raise exception 'Só fundadores votam nas pautas.' using errcode = 'P0001';
  end if;
  select * into e from public.enquetes where id = p_enquete;
  if e.id is null or not e.aberta then raise exception 'Votação encerrada.' using errcode = 'P0001'; end if;
  if p_opcao < 0 or p_opcao >= array_length(e.opcoes, 1) then raise exception 'Opção inválida.' using errcode = 'P0001'; end if;
  insert into public.votos (enquete_id, usuario_id, opcao) values (p_enquete, auth.uid(), p_opcao)
  on conflict (enquete_id, usuario_id) do update set opcao = excluded.opcao, criado_em = now();
end $$;
revoke execute on function public.votar(uuid, int) from public, anon;

create or replace function public.resultado_enquetes()
returns table (id uuid, pergunta text, opcoes text[], aberta boolean, criado_em timestamptz, votos int[], total bigint, meu_voto int)
language sql stable security definer set search_path = public as $$
  select e.id, e.pergunta, e.opcoes, e.aberta, e.criado_em,
         array(select (select count(*) from public.votos v where v.enquete_id = e.id and v.opcao = i)::int
               from generate_series(0, array_length(e.opcoes, 1) - 1) i),
         (select count(*) from public.votos v where v.enquete_id = e.id),
         (select v.opcao from public.votos v where v.enquete_id = e.id and v.usuario_id = auth.uid())
  from public.enquetes e order by e.aberta desc, e.criado_em desc limit 20;
$$;

grant execute on function public.clube_fundadores, public.mural_fundadores, public.resultado_enquetes, public.selo_fundador to anon, authenticated;
grant execute on function public.comentarios_noticia to anon, authenticated;
grant execute on function public.votar to authenticated;
grant execute on function public.ativar_fundador(uuid) to service_role;
