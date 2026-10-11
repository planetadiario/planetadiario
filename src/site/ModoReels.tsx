import { useEffect, useRef, useState } from "react";
import Icone from "../Icone";
import { aoClicar, buscarNoticias, navegar, nomeCategoria, type Leitor, type Noticia } from "./base";
import { Selos } from "./Inicio";

/** Feed vertical em tela cheia, um vídeo por vez (estilo Reels) */
export default function ModoReels({ leitor, inicio }: { leitor: Leitor | null | undefined; inicio?: string }) {
  const [itens, setItens] = useState<Noticia[]>([]);
  const [som, setSom] = useState(false);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (leitor === undefined) return;
    buscarNoticias(undefined, undefined, 40).then((n) => {
      const comVideo = n.filter((x) => x.video_url);
      setItens(comVideo);
      if (inicio) {
        const i = comVideo.findIndex((x) => x.slug === inicio);
        if (i > 0) requestAnimationFrame(() => lista.current?.children[i]?.scrollIntoView());
      }
    });
  }, [leitor, inicio]);

  return (
    <div className="fixed inset-0 z-30 bg-black text-white">
      <div ref={lista} className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none]">
        {itens.map((n) => (
          <ItemReel key={n.id} n={n} som={som} />
        ))}
        {itens.length === 0 && <p className="grid h-full place-items-center text-white/60">Carregando…</p>}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <a href="/" onClick={aoClicar("/")} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur">← Planeta Diário</a>
        <button onClick={() => setSom(!som)} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur">
          {som ? "🔊 Som ligado" : "🔇 Ativar som"}
        </button>
      </div>
    </div>
  );
}

function ItemReel({ n, som }: { n: Noticia; som: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          v.currentTime = 0;
          v.play().catch(() => {});
          window.history.replaceState({}, "", `/reels/${n.slug}`);
        } else v.pause();
      },
      { threshold: 0.6 },
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, [n.slug]);

  useEffect(() => {
    if (ref.current) ref.current.muted = !som;
  }, [som]);

  return (
    <section className="relative flex h-full snap-start snap-always items-center justify-center">
      <video
        ref={ref}
        src={n.video_url ?? undefined}
        poster={n.thumb_url ?? undefined}
        loop
        playsInline
        muted
        preload="metadata"
        onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
        className="h-full max-h-dvh w-auto max-w-full object-contain"
      />
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-8 sm:right-auto sm:max-w-md">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="rounded bg-marca px-2 py-0.5 font-bold uppercase">{nomeCategoria(n.categoria)}</span>
          <Selos n={n} />
        </div>
        {n.legenda && <p className="line-clamp-2 text-sm text-white/85">{n.legenda.split("\n")[0]}</p>}
      </div>
      <div className="absolute bottom-8 right-3 flex flex-col items-center gap-5 text-xs">
        <button onClick={() => navegar(`/n/${n.slug}`)} className="flex flex-col items-center gap-1">
          <span className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur"><Icone nome="comentario" /></span>
          {n.comentarios ?? 0}
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/n/${n.slug}`;
            if (navigator.share) navigator.share({ title: n.manchete, url }).catch(() => {});
            else navigator.clipboard.writeText(url);
          }}
          className="flex flex-col items-center gap-1"
        >
          <span className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur"><Icone nome="enviar" /></span>
          Enviar
        </button>
        <button onClick={() => navegar(`/n/${n.slug}`)} className="flex flex-col items-center gap-1">
          <span className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur"><Icone nome="novo" /></span>
          Ler
        </button>
      </div>
    </section>
  );
}
