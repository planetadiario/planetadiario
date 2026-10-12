import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { useInstalar } from "../pwa";
import { aoClicar, CATEGORIAS, nomeCategoria, type Leitor } from "./base";
import { Avatar, SeloAssinante } from "./Site";
import { ChamadaAssinatura } from "./Inicio";

type Nav = { aoNavegar?: () => void };

function Item({ href, rotulo, icone, ativo, recolhida, aoNavegar }: Nav & { href: string; rotulo: string; icone: string; ativo: boolean; recolhida: boolean }) {
  const externo = href.startsWith("/painel");
  return (
    <a
      href={href}
      title={recolhida ? rotulo : undefined}
      onClick={(e) => {
        if (!externo) aoClicar(href)(e);
        aoNavegar?.();
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${recolhida ? "justify-center px-0" : ""} ${
        ativo ? "bg-marca/10 font-semibold text-marca" : "hover:bg-painel-2"
      }`}
    >
      <Icone nome={icone} className="size-5 shrink-0" />
      {!recolhida && <span className="truncate">{rotulo}</span>}
    </a>
  );
}

/** Coluna esquerda: navegação principal + categorias (recolhe para só ícones) */
export function ColunaEsquerda({ caminho, leitor, recolhida, aoNavegar }: Nav & { caminho: string; leitor: Leitor | null | undefined; recolhida: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <Item href="/" rotulo="Início" icone="inicio" ativo={caminho === "/"} recolhida={recolhida} aoNavegar={aoNavegar} />
      <Item href="/reels" rotulo="Reels" icone="reels" ativo={false} recolhida={recolhida} aoNavegar={aoNavegar} />
      {leitor && <Item href="/conta" rotulo="Minha conta" icone="usuario" ativo={caminho === "/conta"} recolhida={recolhida} aoNavegar={aoNavegar} />}
      {!leitor?.assinante && <Item href="/assinar" rotulo="Assine o Pro" icone="estrela" ativo={caminho === "/assinar"} recolhida={recolhida} aoNavegar={aoNavegar} />}
      {leitor?.admin && <Item href="/painel" rotulo="Painel admin" icone="ajustes" ativo={false} recolhida={recolhida} aoNavegar={aoNavegar} />}

      {!recolhida && (
        <>
          <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-suave">Categorias</p>
          {CATEGORIAS.map((c) => {
            const href = `/c/${c.slug}`;
            const ativo = caminho === href;
            return (
              <a
                key={c.slug}
                href={href}
                onClick={(e) => {
                  aoClicar(href)(e);
                  aoNavegar?.();
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${ativo ? "bg-marca/10 font-semibold text-marca" : "text-suave hover:bg-painel-2 hover:text-texto"}`}
              >
                <span className={`size-1.5 rounded-full ${ativo ? "bg-marca" : "bg-suave/50"}`} />
                {c.label}
              </a>
            );
          })}
        </>
      )}
    </nav>
  );
}

const REDES = [
  {
    nome: "Facebook",
    url: "https://www.facebook.com/1409105185617404",
    cor: "bg-fb",
    svg: "M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z",
  },
  {
    nome: "Instagram",
    url: "https://www.instagram.com/planetadiario.news",
    cor: "bg-ig",
    svg: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
  },
];

/** Coluna direita: instalar app, mais lidas, assinatura, ranking e redes */
export function ColunaDireita({ leitor, aoNavegar }: Nav & { leitor: Leitor | null | undefined }) {
  const [lidas, setLidas] = useState<{ slug: string; manchete: string; categoria: string }[]>([]);
  const [ranking, setRanking] = useState<{ nome: string; avatar: string | null; pontos: number; assinante: boolean }[]>([]);
  const instalar = useInstalar();
  const [dicaIos, setDicaIos] = useState(false);

  useEffect(() => {
    supabase.rpc("mais_lidas", { p_limite: 5 }).then(({ data }) => setLidas(data ?? []));
    supabase.rpc("ranking_leitores", { p_limite: 5 }).then(({ data }) => setRanking(data ?? []));
  }, [leitor?.assinante]);

  return (
    <div className="flex flex-col gap-5">
      {instalar && (
        <div className="cartao flex items-center gap-3 p-4">
          <img src="/icone-192.png" alt="" className="size-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">App Planeta Diário</p>
            <p className="text-xs text-suave">{dicaIos ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Instale e abra como um app."}</p>
          </div>
          {!dicaIos && (
            <button
              onClick={() => (instalar.tipo === "ios" ? setDicaIos(true) : instalar.instalar())}
              className="flex items-center gap-1.5 rounded-full bg-marca px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Icone nome="instalar" className="size-3.5" /> Instalar
            </button>
          )}
        </div>
      )}

      {lidas.length > 0 && (
        <section className="cartao p-4">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-suave">Mais lidas da semana</h3>
          <ol className="flex flex-col gap-3">
            {lidas.map((n, i) => (
              <li key={n.slug}>
                <a
                  href={`/n/${n.slug}`}
                  onClick={(e) => {
                    aoClicar(`/n/${n.slug}`)(e);
                    aoNavegar?.();
                  }}
                  className="group flex gap-3"
                >
                  <span className="w-5 shrink-0 text-lg font-bold leading-none text-marca">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-suave">{nomeCategoria(n.categoria)}</span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{n.manchete}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!leitor?.assinante && <ChamadaAssinatura />}

      {ranking.length > 0 && (
        <section className="cartao p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-suave">
            <Icone nome="trofeu" className="size-3.5" /> Leitores em destaque
          </h3>
          <ol className="flex flex-col gap-2.5">
            {ranking.map((l, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <span className="w-4 text-xs font-bold text-suave">{i + 1}</span>
                <Avatar nome={l.nome ?? "?"} url={l.avatar} />
                <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                {l.assinante && <SeloAssinante />}
                <span className="text-xs font-semibold tabular-nums">{l.pontos}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="cartao p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-suave">Siga o Planeta Diário</h3>
        <div className="grid grid-cols-2 gap-2">
          {REDES.map((r) => (
            <a key={r.nome} href={r.url} target="_blank" rel="noreferrer" className={`${r.cor} flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white`}>
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d={r.svg} /></svg>
              {r.nome}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
