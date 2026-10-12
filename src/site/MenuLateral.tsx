import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { aoClicar, CATEGORIAS, entrarComGoogle, nomeCategoria, type Leitor } from "./base";
import { Avatar, LogoGoogle, SeloAssinante } from "./Site";
import { ChamadaAssinatura } from "./Inicio";

const REDES = [
  { nome: "Facebook", url: "https://www.facebook.com/1409105185617404", cor: "bg-fb" },
  { nome: "Instagram", url: "https://www.instagram.com/planetadiario.news", cor: "bg-ig" },
];

/** Menu lateral direito do site (fixo no desktop, gaveta no celular) */
export default function MenuLateral({ leitor, caminho, aoNavegar }: { leitor: Leitor | null | undefined; caminho: string; aoNavegar?: () => void }) {
  const [lidas, setLidas] = useState<{ slug: string; manchete: string; thumb_url: string | null; categoria: string; visualizacoes: number }[]>([]);
  const [ranking, setRanking] = useState<{ nome: string; avatar: string | null; pontos: number; assinante: boolean }[]>([]);

  useEffect(() => {
    supabase.rpc("mais_lidas", { p_limite: 5 }).then(({ data }) => setLidas(data ?? []));
    supabase.rpc("ranking_leitores", { p_limite: 5 }).then(({ data }) => setRanking(data ?? []));
  }, [leitor?.assinante]);

  const link = (href: string, rotulo: string, icone: string) => {
    const ativo = caminho === href;
    return (
      <a
        href={href}
        onClick={(e) => {
          aoClicar(href)(e);
          aoNavegar?.();
        }}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${ativo ? "bg-marca/10 font-semibold text-marca" : "hover:bg-painel-2"}`}
      >
        <Icone nome={icone} className="size-4" /> {rotulo}
      </a>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* conta */}
      <div className="cartao p-4">
        {leitor ? (
          <div className="flex items-center gap-3">
            <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-10" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {leitor.nome.split(" ")[0]} {leitor.assinante && <SeloAssinante />}
              </p>
              <p className="text-xs text-suave">{leitor.pontos} pontos</p>
            </div>
          </div>
        ) : leitor === null ? (
          <button onClick={() => entrarComGoogle()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-borda py-2 text-sm font-medium hover:bg-painel-2">
            <LogoGoogle /> Entrar com o Google
          </button>
        ) : null}
        <nav className="mt-3 flex flex-col gap-0.5">
          {link("/", "Início", "visao")}
          {link("/reels", "Modo Reels", "producao")}
          {leitor && link("/conta", "Minha conta", "curtida")}
          {!leitor?.assinante && link("/assinar", "Assine o Pro", "raio")}
          {leitor?.admin && (
            <a href="/painel" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-painel-2">
              <Icone nome="ajustes" className="size-4" /> Painel admin
            </a>
          )}
        </nav>
      </div>

      {/* categorias */}
      <div className="cartao p-4">
        <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-suave">Categorias</h3>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => {
            const href = `/c/${c.slug}`;
            return (
              <a
                key={c.slug}
                href={href}
                onClick={(e) => {
                  aoClicar(href)(e);
                  aoNavegar?.();
                }}
                className={`rounded-full border px-2.5 py-1 text-xs ${caminho === href ? "border-marca bg-marca/10 text-marca" : "border-borda hover:bg-painel-2"}`}
              >
                {c.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* mais lidas */}
      {lidas.length > 0 && (
        <div className="cartao p-4">
          <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-suave">Mais lidas da semana</h3>
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
        </div>
      )}

      {!leitor?.assinante && <ChamadaAssinatura />}

      {/* ranking */}
      {ranking.length > 0 && (
        <div className="cartao p-4">
          <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-suave">🏆 Leitores em destaque</h3>
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
        </div>
      )}

      {/* redes */}
      <div className="cartao p-4">
        <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-suave">Siga o Planeta Diário</h3>
        <div className="grid grid-cols-2 gap-2">
          {REDES.map((r) => (
            <a key={r.nome} href={r.url} target="_blank" rel="noreferrer" className={`${r.cor} rounded-lg py-2 text-center text-sm font-semibold text-white`}>
              {r.nome}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
