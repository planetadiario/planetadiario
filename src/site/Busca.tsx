import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { aoClicar, nomeCategoria, quando } from "./base";

interface Resultado {
  slug: string;
  manchete: string;
  thumb_url: string | null;
  categoria: string;
  site_publicado_em: string;
}

export default function Busca({ termo }: { termo: string }) {
  const [itens, setItens] = useState<Resultado[] | null>(null);

  useEffect(() => {
    setItens(null);
    if (!termo) return setItens([]);
    supabase.rpc("buscar_noticias", { p_q: termo, p_limite: 40 }).then(({ data }) => setItens(data ?? []));
  }, [termo]);

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">
        Resultados para <span className="text-marca">“{termo}”</span>
      </h1>
      {itens === null ? (
        <p className="text-suave">Buscando…</p>
      ) : itens.length === 0 ? (
        <p className="py-16 text-center text-suave">Nenhuma notícia encontrada. Tente outras palavras.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((n) => (
            <li key={n.slug}>
              <a href={`/n/${n.slug}`} onClick={aoClicar(`/n/${n.slug}`)} className="group flex gap-4 rounded-xl p-2 hover:bg-painel-2">
                <span className="aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                  {n.thumb_url && <img src={n.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <span className="flex flex-col gap-1.5 py-1">
                  <span className="text-xs font-bold uppercase text-marca">{nomeCategoria(n.categoria)}</span>
                  <span className="text-lg font-semibold leading-snug group-hover:underline">{n.manchete}</span>
                  <span className="text-xs text-suave">{quando(n.site_publicado_em)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
