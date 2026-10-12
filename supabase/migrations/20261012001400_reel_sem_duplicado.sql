-- o mesmo vídeo de origem nunca vira dois Reels ativos
create unique index if not exists reels_origem_unica on public.reels (origem_url)
  where status not in ('rejeitado', 'erro');
