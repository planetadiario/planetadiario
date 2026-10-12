-- Minha conta: atividade, posição no ranking e chamadas nas legendas

-- comentários e curtidas do próprio usuário, com a notícia
create or replace function public.minha_atividade()
returns table (tipo text, texto text, quando timestamptz, slug text, manchete text, thumb_url text)
language sql stable security definer set search_path = public as $$
  (select 'comentario', c.texto, c.criado_em, r.slug, r.manchete, r.thumb_url
     from public.comentarios c join public.reels r on r.id = c.noticia_id
    where c.usuario_id = auth.uid())
  union all
  (select 'curtida', null, k.criado_em, r.slug, r.manchete, r.thumb_url
     from public.curtidas k join public.reels r on r.id = k.noticia_id
    where k.usuario_id = auth.uid())
  order by 3 desc limit 100;
$$;

create or replace function public.minha_posicao()
returns table (posicao bigint, total bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) + 1 from public.perfis o where o.pontos > p.pontos),
         (select count(*) from public.perfis where pontos > 0)
  from public.perfis p where p.id = auth.uid();
$$;

revoke execute on function public.minha_atividade(), public.minha_posicao() from public, anon;
grant execute on function public.minha_atividade(), public.minha_posicao() to authenticated;

-- nome do perfil editável (até 40 caracteres)
create or replace function public.proteger_pontos() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.pontos := old.pontos;
    new.nome := left(btrim(coalesce(new.nome, old.nome)), 40);
  end if;
  return new;
end $$;

-- linha do Clube de Fundadores no fim de toda legenda
insert into public.config (chave, valor) values
  ('cta_facebook', '"⭐ Seja fundador do Planeta Diário por R$ 15,90: planetadiario.online/fundadores"'),
  ('cta_instagram', '"⭐ Seja fundador do Planeta Diário por R$ 15,90 — link na bio"')
on conflict (chave) do nothing;

-- primeira votação de pautas
insert into public.enquetes (pergunta, opcoes)
select 'Qual tema você quer ver mais no Planeta Diário?',
       array['Ciência e espaço', 'Esportes', 'Curiosidades do mundo', 'Tecnologia e IA', 'Notícias do Brasil', 'Animais e natureza']
where not exists (select 1 from public.enquetes);
