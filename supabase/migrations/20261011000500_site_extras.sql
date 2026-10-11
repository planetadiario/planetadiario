-- preço público da assinatura
create or replace function public.preco_assinatura() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::int from public.config where chave = 'assinatura_preco_centavos'), 990);
$$;
grant execute on function public.preco_assinatura to anon, authenticated;

-- pontos em dobro para assinantes (+10 em vez de +5)
create or replace function public.pontuar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comentarios
      where usuario_id = new.usuario_id and criado_em > now() - interval '1 day') <= 10 then
    update public.perfis
       set pontos = pontos + case when public.is_assinante(new.usuario_id) then 10 else 5 end
     where id = new.usuario_id;
  end if;
  return new;
end $$;
