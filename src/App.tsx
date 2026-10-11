import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import Login from "./paginas/Login";
import Radar from "./paginas/Radar";
import Producao from "./paginas/Producao";
import NovoReel from "./paginas/NovoReel";
import Ajustes from "./paginas/Ajustes";

const ABAS = [
  { id: "radar", nome: "Radar", icone: "📡" },
  { id: "producao", nome: "Produção", icone: "🎬" },
  { id: "novo", nome: "Novo Reel", icone: "➕" },
  { id: "ajustes", nome: "Ajustes", icone: "⚙️" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [aba, setAba] = useState<Aba>(() => {
    try {
      return (localStorage.getItem("aba") as Aba) || "radar";
    } catch {
      return "radar";
    }
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  function trocar(a: Aba) {
    setAba(a);
    try {
      localStorage.setItem("aba", a);
    } catch {
      /* sem storage */
    }
  }

  if (sessao === undefined) return null;
  if (!sessao) return <Login />;

  return (
    <div className="min-h-dvh pb-20 md:pb-0 md:pl-56">
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-borda bg-painel/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-56 md:flex-col md:border-r md:border-t-0 md:p-4">
        <img src="/logo.png" alt="Planeta Diário" className="mb-6 hidden w-40 md:block" />
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => trocar(a.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:py-2.5 md:text-sm ${
              aba === a.id ? "text-white md:bg-marca/15" : "text-suave hover:text-white"
            }`}
          >
            <span className="text-lg md:text-base">{a.icone}</span>
            {a.nome}
          </button>
        ))}
        <button
          onClick={() => supabase.auth.signOut()}
          className="hidden text-left text-xs text-suave hover:text-white md:mt-auto md:block md:px-3"
        >
          Sair ({sessao.user.email})
        </button>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {aba === "radar" && <Radar irParaProducao={() => trocar("producao")} />}
        {aba === "producao" && <Producao />}
        {aba === "novo" && <NovoReel criado={() => trocar("producao")} />}
        {aba === "ajustes" && <Ajustes />}
      </main>
    </div>
  );
}
