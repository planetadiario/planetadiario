-- Segurança: limites contra spam/abuso e menos exposição de dados

-- (15) rate limit de comentários: 5 por minuto e 40 por hora por usuário
create or replace function public.limitar_comentarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comentarios where usuario_id = new.usuario_id and criado_em > now() - interval '1 minute') >= 5
     or (select count(*) from public.comentarios where usuario_id = new.usuario_id and criado_em > now() - interval '1 hour') >= 40 then
    raise exception 'Muitos comentários em pouco tempo. Aguarde um pouco.' using errcode = 'P0001';
  end if;
  new.texto := btrim(new.texto);
  return new;
end $$;
drop trigger if exists limita_comentarios on public.comentarios;
create trigger limita_comentarios before insert on public.comentarios for each row execute function public.limitar_comentarios();

-- (15) rate limit de cobranças PIX: no máximo 3 pendentes por hora por usuário
create or replace function public.limitar_assinaturas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.assinaturas where usuario_id = new.usuario_id and status = 'pendente' and criado_em > now() - interval '1 hour') >= 3 then
    raise exception 'Muitas tentativas de pagamento. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limita_assinaturas on public.assinaturas;
create trigger limita_assinaturas before insert on public.assinaturas for each row execute function public.limitar_assinaturas();

-- (6/16) curtidas: cada um vê só as próprias (contagens públicas vêm da função interacoes)
drop policy if exists curtidas_le on public.curtidas;
create policy curtidas_le on public.curtidas for select to authenticated using (usuario_id = auth.uid());

-- (16) perfis: só campos públicos já existem (nome, avatar, pontos); usuário não altera pontos (trigger protege_pontos)
-- (12) busca: limita o tamanho do termo
create or replace function public.buscar_noticias(p_q text, p_limite int default 30)
returns table (slug text, manchete text, thumb_url text, categoria text, site_publicado_em timestamptz)
language sql stable security definer set search_path = public as $$
  with q as (select left(btrim(coalesce(p_q, '')), 100) as t)
  select r.slug, r.manchete, r.thumb_url, r.categoria, r.site_publicado_em
  from public.reels r, q
  where length(q.t) >= 2
    and r.site_publicado_em is not null
    and (r.liberado_em <= now() or public.is_assinante())
    and (r.manchete ilike '%' || q.t || '%' or r.legenda ilike '%' || q.t || '%' or array_to_string(r.hashtags, ' ') ilike '%' || q.t || '%')
  order by r.site_publicado_em desc
  limit least(p_limite, 60);
$$;
