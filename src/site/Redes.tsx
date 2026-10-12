import { useState } from "react";
import Icone from "../Icone";
import IconeRede, { PERFIS, REDES_INFO } from "../IconeRede";

/** "Siga o Planeta Diário": cartões com os perfis oficiais em todas as redes */
export function SigaRedes({ titulo = "Siga o Planeta Diário", compacto = false }: { titulo?: string; compacto?: boolean }) {
  if (compacto) {
    return (
      <section className="cartao p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-suave">{titulo}</h3>
        <div className="grid grid-cols-6 gap-1.5">
          {PERFIS.map((p) => (
            <a
              key={p.rede}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              title={`${REDES_INFO[p.rede].nome} · ${p.usuario}`}
              className="grid aspect-square place-items-center rounded-lg bg-painel-2 transition hover:scale-105"
            >
              <IconeRede rede={p.rede} className="size-5" />
            </a>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold">{titulo}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PERFIS.map((p) => (
          <a
            key={p.rede}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-borda p-3 transition hover:bg-painel-2"
          >
            <IconeRede rede={p.rede} className="size-7 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{REDES_INFO[p.rede].nome}</span>
              <span className="block truncate text-xs text-suave">{p.chamada}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** Compartilhar a notícia em qualquer rede (ou pelo menu nativo do celular) */
export function Compartilhar({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const t = encodeURIComponent(titulo);
  const u = encodeURIComponent(url);
  const destinos = [
    { rede: "whatsapp", href: `https://wa.me/?text=${t}%20${u}` },
    { rede: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { rede: "x", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { rede: "threads", href: `https://www.threads.com/intent/post?text=${t}%20${u}` },
    { rede: "telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
  ] as const;

  return (
    <div className="mt-8">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-suave">Compartilhe</p>
      <div className="flex flex-wrap items-center gap-2">
        {destinos.map((d) => (
          <a
            key={d.rede}
            href={d.href}
            target="_blank"
            rel="noreferrer"
            title={`Compartilhar no ${REDES_INFO[d.rede].nome}`}
            className="grid size-11 place-items-center rounded-full border border-borda transition hover:bg-painel-2"
          >
            <IconeRede rede={d.rede} className="size-5" />
          </a>
        ))}
        <button
          onClick={() => navigator.clipboard.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); })}
          className="flex h-11 items-center gap-2 rounded-full border border-borda px-4 text-sm font-semibold hover:bg-painel-2"
        >
          <Icone nome={copiado ? "check" : "link"} className="size-4" /> {copiado ? "Link copiado" : "Copiar link"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={() => navigator.share({ title: titulo, url }).catch(() => {})}
            className="flex h-11 items-center gap-2 rounded-full bg-marca px-4 text-sm font-semibold text-white"
          >
            <Icone nome="compartilhar" className="size-4" /> Mais opções
          </button>
        )}
      </div>
    </div>
  );
}
