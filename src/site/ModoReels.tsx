import { useEffect, useRef, useState } from "react";
import Icone from "../Icone";
import { aoClicar, buscarInteracoes, buscarNoticias, compartilhar, curtir, entrarComGoogle, navegar, nomeCategoria, numeroCompacto, paragrafosSite, quando, resumoSite, type Interacao, type Leitor, type Noticia } from "./base";
import { Selos } from "./Inicio";
import { Comentarios } from "./PaginaNoticia";

/**
 * Feed vertical em tela cheia (estilo Reels).
 * Desktop: vídeo à esquerda + painel à direita com descrição, compartilhar e comentários.
 * Celular: o painel abre como folha de baixo para cima.
 */
export default function ModoReels({ leitor, inicio }: { leitor: Leitor | null | undefined; inicio?: string }) {
  const [itens, setItens] = useState<Noticia[]>([]);
  const [atual, setAtual] = useState(0);
  const [som, setSom] = useState(false);
  const [folha, setFolha] = useState(false);
  const [painel, setPainel] = useState(false); // abre com o painel de comentários fechado
  const [inter, setInter] = useState<Record<string, Interacao>>({});
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (leitor === undefined) return;
    buscarNoticias(undefined, undefined, 40).then((n) => {
      const comVideo = n.filter((x) => x.video_url);
      setItens(comVideo);
      buscarInteracoes(comVideo.map((x) => x.id)).then(setInter);
      const i = inicio ? comVideo.findIndex((x) => x.slug === inicio) : -1;
      if (i > 0) requestAnimationFrame(() => lista.current?.children[i]?.scrollIntoView());
    });
  }, [leitor, inicio]);

  function ir(delta: number) {
    const alvo = Math.max(0, Math.min(itens.length - 1, atual + delta));
    lista.current?.children[alvo]?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("textarea, input")) return;
      if (e.key === "ArrowDown") ir(1);
      if (e.key === "ArrowUp") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const n = itens[atual];

  async function alternarCurtida(item: Noticia) {
    if (!leitor) return entrarComGoogle();
    const antes = inter[item.id] ?? { id: item.id, curtidas: 0, comentarios: 0, compartilhamentos: 0, curti: false };
    const curti = !antes.curti;
    setInter({ ...inter, [item.id]: { ...antes, curti, curtidas: antes.curtidas + (curti ? 1 : -1) } });
    await curtir(item.id).catch(() => setInter((i) => ({ ...i, [item.id]: antes })));
  }
  async function enviar(item: Noticia) {
    const antes = inter[item.id];
    await compartilhar(item);
    if (antes) setInter((i) => ({ ...i, [item.id]: { ...antes, compartilhamentos: antes.compartilhamentos + 1 } }));
  }
  function comentar() {
    if (window.matchMedia("(min-width: 1024px)").matches) setPainel(true);
    else setFolha(true);
  }

  return (
    <div className="fixed inset-0 z-30 flex bg-black text-white">
      {/* vídeos */}
      <div className="relative min-w-0 flex-1">
        <div ref={lista} className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none]">
          {itens.map((item, i) => (
            <ItemReel
              key={item.id}
              n={item}
              som={som}
              ativo={i === atual}
              aoVer={() => setAtual(i)}
              inter={inter[item.id]}
              acoes={{ curtir: () => alternarCurtida(item), comentar, enviar: () => enviar(item), detalhes: () => setFolha(true) }}
            />
          ))}
          {itens.length === 0 && <p className="grid h-full place-items-center text-white/60">Carregando…</p>}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <a href="/" onClick={aoClicar("/")} className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/40 py-1.5 pl-2 pr-3 text-sm backdrop-blur">
            <Icone nome="esquerda" className="size-4" /> Planeta Diário
          </a>
          <div className="pointer-events-auto flex gap-2">
            <button onClick={() => setSom(!som)} aria-label={som ? "Desativar som" : "Ativar som"} className="grid size-10 place-items-center rounded-full bg-black/40 backdrop-blur">
              <Icone nome={som ? "som" : "mudo"} />
            </button>
            {!painel && n && (
              <button onClick={() => setPainel(true)} aria-label="Abrir painel" className="hidden size-10 place-items-center rounded-full bg-black/40 backdrop-blur lg:grid">
                <Icone nome="abrirPainel" />
              </button>
            )}
          </div>
        </div>

        {/* navegação por setas (desktop) */}
        <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          <button onClick={() => ir(-1)} disabled={atual === 0} aria-label="Anterior" className="grid size-12 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-30">
            <Icone nome="cima" />
          </button>
          <button onClick={() => ir(1)} disabled={atual >= itens.length - 1} aria-label="Próximo" className="grid size-12 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-30">
            <Icone nome="baixo" />
          </button>
        </div>
      </div>

      {/* painel lateral (desktop) */}
      {n && painel && (
        <aside className="hidden w-[400px] shrink-0 border-l border-borda bg-painel text-texto lg:flex">
          <PainelReel n={n} leitor={leitor} esconder={() => setPainel(false)} />
        </aside>
      )}

      {/* folha inferior (celular) */}
      {n && folha && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setFolha(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 flex h-[75dvh] flex-col rounded-t-2xl bg-painel text-texto">
            <div className="flex justify-center py-2"><span className="h-1 w-10 rounded-full bg-borda" /></div>
            <PainelReel n={n} leitor={leitor} fechar={() => setFolha(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PainelReel({ n, leitor, fechar, esconder }: { n: Noticia; leitor: Leitor | null | undefined; fechar?: () => void; esconder?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const paragrafos = paragrafosSite(n.artigo ?? n.legenda ?? "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="flex items-start gap-3 border-b border-borda p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-painel-2"><img src="/globo.png" alt="" className="size-7 object-contain" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Planeta Diário</p>
          <p className="flex items-center gap-1.5 text-xs text-suave">
            <span className="font-bold uppercase text-marca">{nomeCategoria(n.categoria)}</span> · {quando(n.site_publicado_em)}
          </p>
        </div>
        {esconder && (
          <button onClick={esconder} aria-label="Esconder painel" title="Esconder painel" className="grid size-9 place-items-center rounded-full hover:bg-painel-2">
            <Icone nome="fecharPainel" />
          </button>
        )}
        {fechar && (
          <button onClick={fechar} aria-label="Fechar" className="grid size-9 place-items-center rounded-full hover:bg-painel-2">
            <Icone nome="fechar" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
        <div className="mb-2 flex gap-1.5"><Selos n={n} /></div>
        <h2 className="text-lg font-bold leading-snug">{n.manchete}</h2>
        {n.bloqueado ? (
          <p className="mt-2 text-sm text-suave">Conteúdo exclusivo para assinantes.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-texto/90">
            {(aberto ? paragrafos : paragrafos.slice(0, 1)).map((p, i) => (
              <p key={i} className={aberto ? "" : "line-clamp-3"}>{p}</p>
            ))}
          </div>
        )}
        {!n.bloqueado && paragrafos.length > 0 && (
          <button onClick={() => setAberto(!aberto)} className="mt-1 text-sm font-semibold text-suave hover:text-texto">
            {aberto ? "Ver menos" : "Ver mais"}
          </button>
        )}

        <Compartilhar n={n} />

        <div className="mt-5 border-t border-borda pt-4">
          <Comentarios noticiaId={n.id} leitor={leitor} compacto />
        </div>
      </div>
    </div>
  );
}

function Compartilhar({ n }: { n: Noticia }) {
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}/n/${n.slug}`;
  const t = encodeURIComponent(n.manchete), u = encodeURIComponent(url);
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
      <a href={`https://wa.me/?text=${t}%20${u}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-painel-2">
        <span className="grid size-9 place-items-center rounded-full bg-[#25D366] text-white">
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88M20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.94L.06 24l6.31-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.49-8.41" /></svg>
        </span>
        WhatsApp
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-painel-2">
        <span className="grid size-9 place-items-center rounded-full bg-fb text-white">
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" /></svg>
        </span>
        Facebook
      </a>
      <button
        onClick={() => navigator.clipboard.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); })}
        className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-painel-2"
      >
        <span className="grid size-9 place-items-center rounded-full bg-painel-2"><Icone nome={copiado ? "check" : "link"} className="size-4" /></span>
        {copiado ? "Copiado" : "Copiar"}
      </button>
      <button onClick={() => navegar(`/n/${n.slug}`)} className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-painel-2">
        <span className="grid size-9 place-items-center rounded-full bg-painel-2"><Icone nome="seta" className="size-4" /></span>
        Matéria
      </button>
    </div>
  );
}

type Acoes = { curtir: () => void; comentar: () => void; enviar: () => void; detalhes: () => void };

function BotaoAcao({ icone, rotulo, onClick, ativo }: { icone: string; rotulo: string; onClick: () => void; ativo?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-xs font-medium">
      <span className={`grid size-12 place-items-center rounded-full backdrop-blur transition hover:bg-white/25 ${ativo ? "bg-white text-marca" : "bg-white/15"}`}>
        <Icone nome={icone} preenchido={ativo} />
      </span>
      {rotulo}
    </button>
  );
}

function ItemReel({ n, som, ativo, aoVer, inter, acoes }: { n: Noticia; som: boolean; ativo: boolean; aoVer: () => void; inter?: Interacao; acoes: Acoes }) {
  const ref = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && aoVer(), { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [aoVer]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (ativo) {
      v.currentTime = 0;
      v.play().catch(() => {});
      window.history.replaceState({}, "", `/reels/${n.slug}`);
    } else v.pause();
  }, [ativo, n.slug]);

  useEffect(() => {
    if (ref.current) ref.current.muted = !som;
  }, [som]);

  return (
    <section ref={caixa} className="relative flex h-full snap-start snap-always items-end justify-center gap-3 lg:py-4">
      <div className="relative h-full lg:overflow-hidden lg:rounded-xl">
        <video
          ref={ref}
          src={n.video_url ?? undefined}
          poster={n.thumb_url ?? undefined}
          loop
          playsInline
          muted
          preload="metadata"
          onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
          className="h-full max-h-dvh w-auto max-w-[100vw] object-contain"
        />
        {/* legenda curta sobre o vídeo (celular) */}
        <div className="absolute bottom-0 left-0 right-16 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:hidden">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-marca px-2 py-0.5 font-bold uppercase">{nomeCategoria(n.categoria)}</span>
            <Selos n={n} />
          </div>
          {n.legenda && (
            <button onClick={acoes.detalhes} className="line-clamp-2 text-left text-sm text-white/90">
              {resumoSite(n.legenda)}
            </button>
          )}
        </div>
      </div>

      {/* ações: sobre o vídeo no celular, ao lado no desktop (estilo Facebook) */}
      <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-3 flex flex-col items-center gap-4 lg:static lg:mb-2">
        <BotaoAcao icone="curtida" rotulo={numeroCompacto(inter?.curtidas ?? 0)} onClick={acoes.curtir} ativo={inter?.curti} />
        <BotaoAcao icone="comentario" rotulo={numeroCompacto(inter?.comentarios ?? n.comentarios ?? 0)} onClick={acoes.comentar} />
        <BotaoAcao icone="compartilhar" rotulo={numeroCompacto(inter?.compartilhamentos ?? 0)} onClick={acoes.enviar} />
        <div className="relative">
          <BotaoAcao icone="mais" rotulo="" onClick={() => setMenu(!menu)} />
          {menu && (
            <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl bg-painel text-sm text-texto shadow-xl">
              <button onClick={() => navegar(`/n/${n.slug}`)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-painel-2">
                <Icone nome="jornal" className="size-4" /> Abrir matéria
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/n/${n.slug}`);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-painel-2"
              >
                <Icone nome="link" className="size-4" /> Copiar link
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
