import { useEffect, useRef, useState } from "react";
import Icone from "../Icone";
import Anuncio from "./Anuncio";
import { aoClicar, buscarNoticias, CATEGORIAS, nomeCategoria, quando, resumoSite, type Leitor, type Noticia } from "./base";

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

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <Chips atual={categoria} />

      {itens === null ? (
        <Esqueleto />
      ) : itens.length === 0 ? (
        <div className="grid place-items-center gap-3 py-24 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-painel-2 text-suave"><Icone nome="jornal" className="size-7" /></span>
          <p className="font-semibold">Nenhuma notícia {categoria ? `em ${nomeCategoria(categoria)}` : ""} por enquanto</p>
          <p className="text-sm text-suave">Novas notícias chegam a todo momento. Volte em instantes.</p>
        </div>
      ) : (
        <>
          {/* em alta: primeiro, no topo */}
          <Carrossel titulo={categoria ? `Em alta em ${nomeCategoria(categoria)}` : "Em alta agora"} itens={itens.slice(0, 12)} />

          <Anuncio leitor={leitor} onde="home" />

          {/* destaque + lista lateral */}
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Destaque n={itens[0]} />
            <div className="flex flex-col">
              <h2 className="mb-2 text-lg font-bold">Últimas</h2>
              <div className="flex flex-col divide-y divide-borda">
                {(itens.length > 1 ? itens.slice(1, 6) : itens).map((n) => <LinhaNoticia key={n.id} n={n} />)}
              </div>
            </div>
          </section>

          {/* grade completa */}
          <section>
            <h2 className="mb-3 text-lg font-bold">{categoria ? nomeCategoria(categoria) : "Todas as notícias"}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {itens.map((n) => <CartaoGrade key={n.id} n={n} />)}
            </div>
            {mais && (
              <button onClick={carregarMais} className="mx-auto mt-8 block rounded-full border border-borda px-5 py-2 text-sm font-medium hover:bg-painel-2">
                Carregar mais
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Chips de categorias com setas de rolagem (estilo YouTube) */
function Chips({ atual }: { atual?: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [setas, setSetas] = useState({ esq: false, dir: true });

  const atualizar = () => {
    const t = trilho.current;
    if (t) setSetas({ esq: t.scrollLeft > 4, dir: t.scrollLeft + t.clientWidth < t.scrollWidth - 4 });
  };
  const rolar = (d: number) => trilho.current?.scrollBy({ left: d * 300, behavior: "smooth" });

  const chip = (href: string, rotulo: string, ativo: boolean) => (
    <a
      key={href}
      href={href}
      onClick={aoClicar(href)}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${ativo ? "bg-texto text-fundo" : "bg-painel-2 hover:bg-borda"}`}
    >
      {rotulo}
    </a>
  );

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-fundo/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="relative">
        {setas.esq && (
          <button onClick={() => rolar(-1)} aria-label="Rolar para a esquerda" className="absolute left-0 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-fundo shadow-[12px_0_12px_var(--fundo)] hover:bg-painel-2">
            <Icone nome="esquerda" />
          </button>
        )}
        <div ref={trilho} onScroll={atualizar} className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {chip("/", "Tudo", !atual)}
          {CATEGORIAS.map((c) => chip(`/c/${c.slug}`, c.label, atual === c.slug))}
        </div>
        {setas.dir && (
          <button onClick={() => rolar(1)} aria-label="Rolar para a direita" className="absolute right-0 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-fundo shadow-[-12px_0_12px_var(--fundo)] hover:bg-painel-2">
            <Icone nome="direita" />
          </button>
        )}
      </div>
    </div>
  );
}

function Carrossel({ titulo, itens }: { titulo: string; itens: Noticia[] }) {
  const trilho = useRef<HTMLDivElement>(null);
  const rolar = (d: number) => trilho.current?.scrollBy({ left: d * 600, behavior: "smooth" });
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-marca text-white"><Icone nome="reels" className="size-4" /></span>
        <h2 className="text-lg font-bold">{titulo}</h2>
        <a href="/reels" onClick={aoClicar("/reels")} className="ml-auto flex items-center gap-1 text-sm font-medium text-marca">
          Assistir em Reels <Icone nome="seta" className="size-4" />
        </a>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => rolar(-1)} aria-label="Anteriores" className="grid size-8 place-items-center rounded-full border border-borda hover:bg-painel-2"><Icone nome="esquerda" className="size-4" /></button>
          <button onClick={() => rolar(1)} aria-label="Próximos" className="grid size-8 place-items-center rounded-full border border-borda hover:bg-painel-2"><Icone nome="direita" className="size-4" /></button>
        </div>
      </div>
      <div ref={trilho} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
        {itens.map((n) => (
          <a
            key={n.id}
            href={`/reels/${n.slug}`}
            onClick={aoClicar(`/reels/${n.slug}`)}
            className="group relative aspect-[9/16] w-[42%] shrink-0 snap-start overflow-hidden rounded-xl bg-black sm:w-48"
          >
            {/* a capa já traz a manchete gravada pelo molde */}
            {n.thumb_url && <img src={n.thumb_url} alt={n.manchete} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
            <span className="absolute left-2 top-2 flex gap-1"><Selos n={n} /></span>
          </a>
        ))}
      </div>
    </section>
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
    <a
      href={`/n/${n.slug}`}
      onClick={aoClicar(`/n/${n.slug}`)}
      className="group relative isolate grid min-h-[420px] overflow-hidden rounded-2xl bg-black text-white sm:grid-cols-[minmax(200px,36%)_1fr] lg:self-start"
    >
      {/* fundo: a própria capa, desfocada (sem área preta vazia) */}
      {n.thumb_url && <img src={n.thumb_url} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/30 via-black/60 to-black/85" />

      <div className="relative aspect-[9/16] w-full sm:aspect-auto sm:h-full">
        {n.thumb_url && <img src={n.thumb_url} alt="" className="absolute inset-0 h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]" />}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-marca">
            <svg viewBox="0 0 24 24" className="ml-1 size-6 fill-white" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      </div>

      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-marca px-2 py-0.5 font-bold uppercase">{nomeCategoria(n.categoria)}</span>
          <Selos n={n} />
          <span className="text-white/70">{quando(n.site_publicado_em)}</span>
        </div>
        <h2 className="text-2xl font-bold leading-tight sm:text-3xl xl:text-4xl">{n.manchete}</h2>
        {n.legenda && <p className="line-clamp-4 text-base text-white/80">{resumoSite(n.legenda)}</p>}
        <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition group-hover:bg-marca group-hover:text-white">
          Ler a notícia <Icone nome="seta" className="size-4" />
        </span>
      </div>
    </a>
  );
}

function LinhaNoticia({ n }: { n: Noticia }) {
  return (
    <a href={`/n/${n.slug}`} onClick={aoClicar(`/n/${n.slug}`)} className="group flex gap-3 py-3">
      <span className="aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-md bg-black">
        {n.thumb_url && <img src={n.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="font-bold uppercase text-marca">{nomeCategoria(n.categoria)}</span>
          <span className="text-suave">· {quando(n.site_publicado_em)}</span>
        </span>
        <span className="line-clamp-3 text-sm font-semibold leading-snug group-hover:underline">{n.manchete}</span>
      </span>
    </a>
  );
}

function CartaoGrade({ n }: { n: Noticia }) {
  return (
    <a href={`/n/${n.slug}`} onClick={aoClicar(`/n/${n.slug}`)} className="group flex flex-col gap-2">
      <span className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
        {n.thumb_url && <img src={n.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <span className="absolute left-2 top-2 flex gap-1"><Selos n={n} /></span>
      </span>
      <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">{n.manchete}</span>
      <span className="flex items-center gap-2 text-xs text-suave">
        <span className="font-semibold uppercase text-marca">{nomeCategoria(n.categoria)}</span>· {quando(n.site_publicado_em)}
        {!!n.comentarios && (
          <span className="ml-auto flex items-center gap-1"><Icone nome="comentario" className="size-3.5" /> {n.comentarios}</span>
        )}
      </span>
    </a>
  );
}

const BENEFICIOS_CURTOS = [
  ["raio", "Notícias antes das redes sociais"],
  ["cadeado", "Conteúdo exclusivo"],
  ["proibido", "Site sem anúncios"],
  ["trofeu", "Selo Pro e pontos em dobro no ranking"],
];

export function ChamadaAssinatura() {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-marca to-[#9b0b12] p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-wider text-white/80">Planeta Diário Pro</p>
      <p className="mt-1 text-xl font-bold leading-tight">Saiba antes de todo mundo</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/90">
        {BENEFICIOS_CURTOS.map(([icone, texto]) => (
          <li key={texto} className="flex items-center gap-2"><Icone nome={icone} className="size-4 shrink-0" />{texto}</li>
        ))}
      </ul>
      <a href="/assinar" onClick={aoClicar("/assinar")} className="mt-4 block rounded-full bg-white py-2 text-center text-sm font-bold text-marca">
        Assinar agora
      </a>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-7">
      <div className="flex gap-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[9/16] w-48 shrink-0 rounded-xl bg-painel-2" />)}
      </div>
      <div className="h-[360px] rounded-2xl bg-painel-2" />
    </div>
  );
}
