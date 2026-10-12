import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import Icone from "./Icone";
import Login from "./paginas/Login";
import Visao from "./paginas/Visao";
import Radar from "./paginas/Radar";
import Producao from "./paginas/Producao";
import Moldes from "./paginas/Moldes";
import NovoReel from "./paginas/NovoReel";
import Ajustes from "./paginas/Ajustes";
import FundadoresAdmin from "./paginas/Fundadores";

const ABAS = [
  { id: "visao", nome: "Visão geral", icone: "visao" },
  { id: "radar", nome: "Radar", icone: "radar" },
  { id: "producao", nome: "Produção", icone: "producao" },
  { id: "novo", nome: "Novo Reel", icone: "novo" },
  { id: "moldes", nome: "Moldes", icone: "moldes" },
  { id: "fundadores", nome: "Fundadores", icone: "estrela" },
  { id: "ajustes", nome: "Ajustes", icone: "ajustes" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem storage */
  }
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [aba, setAba] = useState<Aba>(() => (ABAS.some((a) => a.id === ler("aba")) ? (ler("aba") as Aba) : "visao"));
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains("dark"));
  const [recolhido, setRecolhido] = useState(() => ler("menu") === "recolhido");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  function trocar(a: Aba) {
    setAba(a);
    gravar("aba", a);
  }
  function alternarMenu() {
    setRecolhido(!recolhido);
    gravar("menu", recolhido ? "aberto" : "recolhido");
  }
  function alternarTema() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    gravar("tema", novo ? "escuro" : "claro");
  }

  if (sessao === undefined) return null;
  if (!sessao) return <Login />;
  const atual = ABAS.find((a) => a.id === aba)!;

  return (
    <div className={`min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] transition-[padding] md:pb-0 ${recolhido ? "md:pl-[72px]" : "md:pl-60"}`}>
      <nav
        className={`fixed inset-x-0 bottom-0 z-20 flex border-t border-borda bg-painel pb-[env(safe-area-inset-bottom)] transition-[width] md:inset-y-0 md:left-0 md:right-auto md:flex-col md:border-r md:border-t-0 md:px-3 md:py-5 ${
          recolhido ? "md:w-[72px]" : "md:w-60"
        }`}
      >
        <div className={`mb-8 hidden items-center gap-2 md:flex ${recolhido ? "justify-center" : "px-3"}`}>
          {recolhido ? (
            <img src="/icone-192.png" alt="Planeta Diário" className="size-9 rounded-full" />
          ) : (
            <>
              <img src="/logo-claro.png" alt="Planeta Diário" className="h-9 dark:hidden" />
              <img src="/logo.png" alt="Planeta Diário" className="hidden h-9 dark:block" />
            </>
          )}
        </div>
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => trocar(a.id)}
            title={recolhido ? a.nome : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition md:mb-1 md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:py-2.5 md:text-sm ${recolhido ? "md:justify-center" : ""} ${
              aba === a.id ? "font-semibold text-marca md:bg-marca/10" : "text-suave hover:text-texto md:hover:bg-painel-2"
            }`}
          >
            <Icone nome={a.icone} />
            <span className={`${a.id === "moldes" || a.id === "ajustes" || a.id === "fundadores" ? "hidden sm:inline" : ""} ${recolhido ? "md:hidden" : ""}`}>{a.nome}</span>
          </button>
        ))}
        <div className={`mt-auto hidden flex-col gap-2 text-xs text-suave md:flex ${recolhido ? "items-center" : "px-3"}`}>
          {!recolhido && <p className="truncate">{sessao.user.email}</p>}
          <a href="/" title="Ver site" className="flex items-center gap-2 hover:text-texto">
            <Icone nome="globo" className="size-4" /> {!recolhido && "Ver site"}
          </a>
          <button onClick={() => supabase.auth.signOut()} title="Sair" className="flex items-center gap-2 hover:text-texto">
            <Icone nome="sair" className="size-4" /> {!recolhido && "Sair"}
          </button>
          <button onClick={alternarMenu} title={recolhido ? "Expandir menu" : "Recolher menu"} className="mt-2 flex items-center gap-2 hover:text-texto">
            <Icone nome={recolhido ? "expandir" : "recolher"} className="size-4" /> {!recolhido && "Recolher"}
          </button>
        </div>
      </nav>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borda bg-fundo/85 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:px-8">
        <h1 className="text-lg font-semibold">{atual.nome}</h1>
        <button
          onClick={alternarTema}
          aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
          className="flex items-center gap-2 rounded-lg border border-borda bg-painel px-3 py-1.5 text-sm text-suave hover:text-texto"
        >
          <Icone nome={escuro ? "sol" : "lua"} className="size-4" />
          <span className="hidden sm:inline">{escuro ? "Claro" : "Escuro"}</span>
        </button>
      </header>

      <main className="w-full px-4 py-6 md:px-6 2xl:px-10">
        {aba === "visao" && <Visao />}
        {aba === "radar" && <Radar irParaProducao={() => trocar("producao")} />}
        {aba === "producao" && <Producao />}
        {aba === "novo" && <NovoReel criado={() => trocar("producao")} />}
        {aba === "moldes" && <Moldes />}
        {aba === "fundadores" && <FundadoresAdmin />}
        {aba === "ajustes" && <Ajustes />}
      </main>
    </div>
  );
}
