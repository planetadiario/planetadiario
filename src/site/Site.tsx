import { useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { aoClicar, CATEGORIAS, entrarComGoogle, useCaminho, useLeitor, type Leitor } from "./base";
import Inicio from "./Inicio";
import PaginaNoticia from "./PaginaNoticia";
import ModoReels from "./ModoReels";
import Assinar from "./Assinar";
import Conta from "./Conta";

export default function Site() {
  const caminho = useCaminho();
  const leitor = useLeitor();
  const [, setTema] = useState(0);

  const partes = caminho.split("/").filter(Boolean);
  if (partes[0] === "reels") return <ModoReels leitor={leitor} inicio={partes[1]} />;

  function alternarTema() {
    const escuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("tema", escuro ? "escuro" : "claro");
    } catch {
      /* sem storage */
    }
    setTema((t) => t + 1);
  }

  let pagina: React.ReactNode;
  if (partes[0] === "n" && partes[1]) pagina = <PaginaNoticia slug={partes[1]} leitor={leitor} />;
  else if (partes[0] === "assinar") pagina = <Assinar leitor={leitor} />;
  else if (partes[0] === "conta") pagina = <Conta leitor={leitor} />;
  else pagina = <Inicio categoria={partes[0] === "c" ? partes[1] : undefined} leitor={leitor} />;

  const catAtual = partes[0] === "c" ? partes[1] : "";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-borda bg-fundo/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a href="/" onClick={aoClicar("/")} className="shrink-0">
            <img src="/logo-claro.png" alt="Planeta Diário" className="h-8 dark:hidden" />
            <img src="/logo.png" alt="Planeta Diário" className="hidden h-8 dark:block" />
          </a>
          <a
            href="/reels"
            onClick={aoClicar("/reels")}
            className="ml-2 hidden items-center gap-1.5 rounded-full bg-marca px-3 py-1.5 text-sm font-semibold text-white sm:flex"
          >
            <Icone nome="producao" className="size-4" /> Reels
          </a>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={alternarTema} aria-label="Alternar tema" className="grid size-9 place-items-center rounded-full text-suave hover:bg-painel-2 hover:text-texto">
              <Icone nome="lua" className="size-4 dark:hidden" />
              <Icone nome="sol" className="hidden size-4 dark:block" />
            </button>
            <BotaoConta leitor={leitor} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm [scrollbar-width:none]">
          <a href="/" onClick={aoClicar("/")} className={`shrink-0 rounded-full px-3 py-1 ${!catAtual && partes.length === 0 ? "bg-texto text-fundo" : "text-suave hover:text-texto"}`}>
            Últimas
          </a>
          {CATEGORIAS.map((c) => (
            <a
              key={c.slug}
              href={`/c/${c.slug}`}
              onClick={aoClicar(`/c/${c.slug}`)}
              className={`shrink-0 rounded-full px-3 py-1 ${catAtual === c.slug ? "bg-texto text-fundo" : "text-suave hover:text-texto"}`}
            >
              {c.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{pagina}</main>

      <footer className="mt-10 border-t border-borda">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-suave">
          <p>© {new Date().getFullYear()} Planeta Diário — tudo o que acontece no mundo, em vídeo.</p>
          <a href="/assinar" onClick={aoClicar("/assinar")} className="font-medium text-marca">Seja assinante</a>
        </div>
      </footer>

      {/* atalho para o modo Reels no celular */}
      <a
        href="/reels"
        onClick={aoClicar("/reels")}
        className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full bg-marca px-4 py-3 text-sm font-semibold text-white shadow-lg sm:hidden"
      >
        <Icone nome="producao" className="size-4" /> Reels
      </a>
    </div>
  );
}

function BotaoConta({ leitor }: { leitor: Leitor | null | undefined }) {
  if (leitor === undefined) return <span className="size-9" />;
  if (!leitor)
    return (
      <button onClick={() => entrarComGoogle()} className="flex items-center gap-2 rounded-full border border-borda bg-painel px-3 py-1.5 text-sm font-medium hover:bg-painel-2">
        <LogoGoogle /> Entrar
      </button>
    );
  return (
    <>
    {leitor.admin && (
      <a href="/painel" className="rounded-full bg-texto px-3 py-1.5 text-sm font-semibold text-fundo">Painel</a>
    )}
    <a href="/conta" onClick={aoClicar("/conta")} className="flex items-center gap-2 rounded-full border border-borda bg-painel py-1 pl-1 pr-3 text-sm hover:bg-painel-2">
      <Avatar nome={leitor.nome} url={leitor.avatar} />
      <span className="hidden max-w-28 truncate sm:inline">{leitor.nome.split(" ")[0]}</span>
      {leitor.assinante && <SeloAssinante />}
    </a>
    </>
  );
}

export function Avatar({ nome, url, tamanho = "size-7" }: { nome: string; url: string | null; tamanho?: string }) {
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className={`${tamanho} rounded-full object-cover`} />
  ) : (
    <span className={`${tamanho} grid place-items-center rounded-full bg-globo text-xs font-bold text-white`}>{nome.slice(0, 1).toUpperCase()}</span>
  );
}

export function SeloAssinante() {
  return (
    <span title="Assinante" className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">
      Pro
    </span>
  );
}

export function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function sair() {
  return supabase.auth.signOut();
}
