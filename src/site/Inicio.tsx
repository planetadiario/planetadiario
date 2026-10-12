import { useEffect, useState } from "react";
import Icone from "../Icone";
import { aoClicar, buscarNoticias, nomeCategoria, quando, type Leitor, type Noticia } from "./base";

export default function Inicio({ categoria, leitor }: { categoria?: string; leitor: Leitor | null | undefined }) {
  const [itens, setItens] = useState<Noticia[] | null>(null);
  const [mais, setMais] = useState(true);

  useEffect(() => {
    setItens(null);
    buscarNoticias(categoria).then((n) => {
      setItens(n);
      setMais(n.length === 24);
    });
  }, [categoria, leitor?.assinante]);

  async function carregarMais() {
    if (!itens?.length) return;
    const n = await buscarNoticias(categoria, itens[itens.length - 1].site_publicado_em);
    setItens([...itens, ...n]);
    setMais(n.length === 24);
  }

  if (itens === null) return <Esqueleto />;
  if (itens.length === 0)
    return <p className="py-20 text-center text-suave">Nenhuma notícia {categoria ? `em ${nomeCategoria(categoria)}` : ""} por enquanto. Volte em instantes.</p>;

  const [destaque, ...resto] = itens;
  const emAlta = resto.slice(0, 8);
  const lista = categoria ? resto : resto.slice(8);

  return (
    <div className="flex min-w-0 flex-col gap-8">
        {categoria && <h1 className="text-2xl font-bold">{nomeCategoria(categoria)}</h1>}

        <Destaque n={destaque} />

        {!categoria && emAlta.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Em alta agora</h2>
              <a href="/reels" onClick={aoClicar("/reels")} className="text-sm font-medium text-marca">Ver em modo Reels →</a>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {emAlta.map((n) => (
                <CartaoReel key={n.id} n={n} />
              ))}
            </div>
          </section>
        )}

        <section>
          {!categoria && <h2 className="mb-3 text-lg font-bold">Últimas notícias</h2>}
          <div className="grid gap-4 sm:grid-cols-2">
            {lista.map((n) => (
              <CartaoLista key={n.id} n={n} />
            ))}
          </div>
          {mais && (
            <button onClick={carregarMais} className="mx-auto mt-6 block rounded-full border border-borda px-5 py-2 text-sm hover:bg-painel-2">
              Carregar mais
            </button>
          )}
        </section>
    </div>
  );
}

export function Selos({ n }: { n: Noticia }) {
  return (
    <>
      {n.antecipado && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Antecipado</span>}
      {n.exclusivo && <span className="rounded bg-texto px-1.5 py-0.5 text-[10px] font-bold uppercase text-fundo">Exclusivo</span>}
    </>
  );
}

function Destaque({ n }: { n: Noticia }) {
  return (
    <a href={`/n/${n.slug}`} onClick={aoClicar(`/n/${n.slug}`)} className="group grid overflow-hidden rounded-2xl bg-black text-white sm:grid-cols-[260px_1fr]">
      <div className="relative aspect-[9/16] max-h-[70vh] w-full sm:max-h-none">
        {n.thumb_url && <img src={n.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-marca">
            <svg viewBox="0 0 24 24" className="ml-1 size-7 fill-white"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      </div>
      <div className="flex flex-col justify-end gap-3 bg-gradient-to-t from-black via-black/90 to-black/70 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-marca px-2 py-0.5 font-bold uppercase">{nomeCategoria(n.categoria)}</span>
          <Selos n={n} />
          <span className="text-white/60">{quando(n.site_publicado_em)}</span>
        </div>
        <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{n.manchete}</h2>
        {n.legenda && <p className="line-clamp-3 text-white/75">{n.legenda.split("\n")[0]}</p>}
      </div>
    </a>
  );
}

function CartaoReel({ n }: { n: Noticia }) {
  return (
    <a href={`/reels/${n.slug}`} onClick={aoClicar(`/reels/${n.slug}`)} className="group relative aspect-[9/16] w-40 shrink-0 snap-start overflow-hidden rounded-xl bg-black sm:w-44">
      {n.thumb_url && <img src={n.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 pt-10">
        <span className="line-clamp-3 text-xs font-semibold leading-snug text-white">{n.manchete}</span>
      </span>
      <span className="absolute left-2 top-2 flex gap-1"><Selos n={n} /></span>
    </a>
  );
}

function CartaoLista({ n }: { n: Noticia }) {
  return (
    <a href={`/n/${n.slug}`} onClick={aoClicar(`/n/${n.slug}`)} className="group flex gap-3 rounded-xl p-2 transition hover:bg-painel-2">
      <span className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-lg bg-black">
        {n.thumb_url && <img src={n.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5 py-1">
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold uppercase text-marca">{nomeCategoria(n.categoria)}</span>
          <Selos n={n} />
        </span>
        <span className="line-clamp-3 font-semibold leading-snug group-hover:underline">{n.manchete}</span>
        <span className="mt-auto flex items-center gap-3 text-xs text-suave">
          {quando(n.site_publicado_em)}
          {!!n.comentarios && (
            <span className="flex items-center gap-1"><Icone nome="comentario" className="size-3.5" /> {n.comentarios}</span>
          )}
        </span>
      </span>
    </a>
  );
}

export function ChamadaAssinatura() {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-marca to-[#9b0b12] p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-wider text-white/80">Planeta Diário Pro</p>
      <p className="mt-1 text-xl font-bold leading-tight">Saiba antes de todo mundo</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/90">
        <li>⚡ Notícias antes das redes sociais</li>
        <li>🔒 Conteúdo exclusivo</li>
        <li>🚫 Site sem anúncios</li>
        <li>🏆 Selo Pro e pontos em dobro no ranking</li>
      </ul>
      <a href="/assinar" onClick={aoClicar("/assinar")} className="mt-4 block rounded-full bg-white py-2 text-center text-sm font-bold text-marca">
        Assinar agora
      </a>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="h-[420px] rounded-2xl bg-painel-2" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-44 rounded-xl bg-painel-2" />)}
      </div>
    </div>
  );
}
