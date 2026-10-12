import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { useInstalar } from "../pwa";
import { aoClicar, CATEGORIAS, nomeCategoria, type Leitor } from "./base";
import { Avatar, SeloAssinante } from "./Site";
import { ChamadaAssinatura } from "./Inicio";
import { SeloFundador } from "./Fundadores";

type Nav = { aoNavegar?: () => void };

export const REDES = [
  {
    nome: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61595405217728",
    cor: "#1877F2",
    svg: "M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z",
  },
  {
    nome: "Instagram",
    url: "https://www.instagram.com/planetadiario.news",
    cor: "#E1306C",
    svg: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
  },
];

function Linha({ href, rotulo, icone, ativo, aoNavegar, externo, children }: Nav & { href: string; rotulo: string; icone?: string; ativo?: boolean; externo?: boolean; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      target={externo ? "_blank" : undefined}
      rel={externo ? "noreferrer" : undefined}
      onClick={(e) => {
        if (!externo && !href.startsWith("/painel")) aoClicar(href)(e);
        aoNavegar?.();
      }}
      className={`flex h-10 items-center gap-5 rounded-lg px-3 text-sm ${ativo ? "bg-painel-2 font-semibold" : "hover:bg-painel-2"}`}
    >
      {children ?? (icone && <Icone nome={icone} className="size-[22px] shrink-0" preenchido={false} />)}
      <span className="truncate">{rotulo}</span>
    </a>
  );
}

function Secao({ titulo, children, seta }: { titulo?: string; children: React.ReactNode; seta?: boolean }) {
  return (
    <div className="border-b border-borda py-3 last:border-0">
      {titulo && (
        <p className="flex items-center gap-1 px-3 pb-1 pt-1 text-base font-semibold">
          {titulo} {seta && <Icone nome="direita" className="size-4" />}
        </p>
      )}
      {children}
    </div>
  );
}

/** Menu esquerdo no estilo YouTube; recolhido vira a "mini guia" só com ícones */
export function ColunaEsquerda({ caminho, leitor, recolhida, aoNavegar }: Nav & { caminho: string; leitor: Leitor | null | undefined; recolhida: boolean }) {
  const [todas, setTodas] = useState(false);
  const instalar = useInstalar();

  if (recolhida)
    return (
      <nav className="flex flex-col gap-1">
        {[
          { href: "/", rotulo: "Início", icone: "inicio" },
          { href: "/reels", rotulo: "Reels", icone: "reels" },
          { href: "/assinar", rotulo: "Pro", icone: "estrela" },
          { href: leitor ? "/conta" : "/assinar", rotulo: "Você", icone: "usuario" },
        ].map((i) => (
          <a
            key={i.rotulo}
            href={i.href}
            onClick={aoClicar(i.href)}
            className={`flex flex-col items-center gap-1.5 rounded-lg py-4 text-[10px] ${caminho === i.href ? "font-semibold" : ""} hover:bg-painel-2`}
          >
            <Icone nome={i.icone} className="size-[22px]" />
            {i.rotulo}
          </a>
        ))}
      </nav>
    );

  const categorias = todas ? CATEGORIAS : CATEGORIAS.slice(0, 7);

  return (
    <nav className="px-3">
      <Secao>
        <Linha href="/" rotulo="Início" icone="inicio" ativo={caminho === "/"} aoNavegar={aoNavegar} />
        <Linha href="/reels" rotulo="Reels" icone="reels" aoNavegar={aoNavegar} />
        <Linha href="/c/urgente" rotulo="Urgente" icone="sirene" ativo={caminho === "/c/urgente"} aoNavegar={aoNavegar} />
      </Secao>

      <Secao titulo="Você" seta>
        {leitor ? (
          <>
            <Linha href="/conta" rotulo="Minha conta" ativo={caminho === "/conta"} aoNavegar={aoNavegar}>
              <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-6" />
            </Linha>
            <Linha href="/conta" rotulo={`${leitor.pontos} pontos`} icone="trofeu" aoNavegar={aoNavegar} />
            {leitor.fundador && (
              <>
                <div className="px-3 py-1.5"><SeloFundador numero={leitor.fundador.numero} /></div>
                <Linha href="/fundadores/certificado" rotulo="Meu certificado" icone="jornal" ativo={caminho === "/fundadores/certificado"} aoNavegar={aoNavegar} />
                <Linha href="/fundadores/votacao" rotulo="Votação de pautas" icone="checkCirculo" ativo={caminho === "/fundadores/votacao"} aoNavegar={aoNavegar} />
              </>
            )}
            <Linha href="/assinar" rotulo={leitor.assinante ? "Assinatura Pro ativa" : "Assinar o Pro"} icone="estrela" ativo={caminho === "/assinar"} aoNavegar={aoNavegar} />
            {leitor.admin && <Linha href="/painel" rotulo="Painel admin" icone="ajustes" aoNavegar={aoNavegar} />}
          </>
        ) : (
          <p className="px-3 py-1 text-sm text-suave">Entre para comentar, curtir e ganhar pontos.</p>
        )}
      </Secao>

      <Secao titulo="Explorar">
        {categorias.map((c) => (
          <Linha key={c.slug} href={`/c/${c.slug}`} rotulo={c.label} icone={c.icone} ativo={caminho === `/c/${c.slug}`} aoNavegar={aoNavegar} />
        ))}
        <button onClick={() => setTodas(!todas)} className="flex h-10 w-full items-center gap-5 rounded-lg px-3 text-sm hover:bg-painel-2">
          <Icone nome={todas ? "cima" : "baixo"} className="size-[22px]" />
          {todas ? "Mostrar menos" : "Mostrar mais"}
        </button>
      </Secao>

      <Secao titulo="Mais do Planeta Diário">
        <Linha href="/fundadores" rotulo="Clube de Fundadores" ativo={caminho === "/fundadores"} aoNavegar={aoNavegar}>
          <span className="grid size-[22px] place-items-center rounded-md bg-gradient-to-br from-amber-300 to-amber-600 text-black"><Icone nome="estrela" className="size-3.5" preenchido /></span>
        </Linha>
        <Linha href="/fundadores/mural" rotulo="Mural dos Fundadores" icone="usuario" ativo={caminho === "/fundadores/mural"} aoNavegar={aoNavegar} />
        {!leitor?.assinante && (
          <Linha href="/assinar" rotulo="Planeta Diário Pro" aoNavegar={aoNavegar}>
            <span className="grid size-[22px] place-items-center rounded-md bg-marca text-white"><Icone nome="estrela" className="size-3.5" /></span>
          </Linha>
        )}
        {REDES.map((r) => (
          <Linha key={r.nome} href={r.url} rotulo={r.nome} externo>
            <svg viewBox="0 0 24 24" className="size-[22px] shrink-0" style={{ fill: r.cor }} aria-hidden="true"><path d={r.svg} /></svg>
          </Linha>
        ))}
        {instalar && instalar.tipo === "prompt" && (
          <button onClick={() => instalar.instalar()} className="flex h-10 w-full items-center gap-5 rounded-lg px-3 text-sm hover:bg-painel-2">
            <Icone nome="instalar" className="size-[22px]" /> Instalar o app
          </button>
        )}
      </Secao>

      <p className="flex gap-3 px-3 pt-4 text-xs text-suave">
        <a href="/termos" onClick={(e) => { aoClicar("/termos")(e); aoNavegar?.(); }} className="hover:text-texto">Termos de Uso</a>
        <a href="/privacidade" onClick={(e) => { aoClicar("/privacidade")(e); aoNavegar?.(); }} className="hover:text-texto">Privacidade</a>
      </p>
      <p className="px-3 py-4 text-xs leading-relaxed text-suave">
        © {new Date().getFullYear()} Planeta Diário
        <br />
        Tudo o que acontece no mundo, em vídeo.
      </p>
    </nav>
  );
}

/** Coluna direita: mais lidas, assinatura e ranking */
export function ColunaDireita({ leitor, aoNavegar }: Nav & { leitor: Leitor | null | undefined }) {
  const [lidas, setLidas] = useState<{ slug: string; manchete: string; categoria: string; thumb_url: string | null }[]>([]);
  const [ranking, setRanking] = useState<{ nome: string; avatar: string | null; pontos: number; assinante: boolean }[]>([]);

  useEffect(() => {
    supabase.rpc("mais_lidas", { p_limite: 5 }).then(({ data }) => setLidas(data ?? []));
    supabase.rpc("ranking_leitores", { p_limite: 5 }).then(({ data }) => setRanking(data ?? []));
  }, [leitor?.assinante]);

  return (
    <div className="flex flex-col gap-5">
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
                  className="group flex items-center gap-3"
                >
                  <span className="w-4 shrink-0 text-lg font-bold leading-none text-marca">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase text-suave">{nomeCategoria(n.categoria)}</span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{n.manchete}</span>
                  </span>
                  {n.thumb_url && <img src={n.thumb_url} alt="" className="h-14 w-8 shrink-0 rounded object-cover" />}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!leitor?.fundador && <ChamadaFundador aoNavegar={aoNavegar} />}
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
    </div>
  );
}

function ChamadaFundador({ aoNavegar }: Nav) {
  return (
    <a
      href="/fundadores"
      onClick={(e) => {
        aoClicar("/fundadores")(e);
        aoNavegar?.();
      }}
      className="group block overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a0a0e] to-black p-5 text-white"
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
        <Icone nome="estrela" className="size-3.5" preenchido /> Clube de Fundadores
      </p>
      <p className="mt-1 text-xl font-bold leading-tight">Seja fundador por R$ 15,90</p>
      <p className="mt-1 text-sm text-white/70">Número eterno, selo exclusivo e seu nome no mural. Pagamento único.</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-300 group-hover:underline">
        Garantir meu número <Icone nome="seta" className="size-4" />
      </span>
    </a>
  );
}
