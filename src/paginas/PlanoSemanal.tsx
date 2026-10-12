import { useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";

export interface MetasSemanais {
  posts_fb: number;
  posts_ig: number;
  stories_fb: number;
  views_fb: number;
  views_ig: number;
  seguidores: number;
}

const ITENS: { chave: keyof MetasSemanais; rotulo: string; icone: string }[] = [
  { chave: "posts_fb", rotulo: "Reels no Facebook", icone: "reels" },
  { chave: "posts_ig", rotulo: "Reels no Instagram", icone: "reels" },
  { chave: "stories_fb", rotulo: "Stories no Facebook", icone: "compartilhar" },
  { chave: "views_fb", rotulo: "Visualizações no Facebook", icone: "video" },
  { chave: "views_ig", rotulo: "Visualizações no Instagram", icone: "video" },
  { chave: "seguidores", rotulo: "Novos seguidores (FB + IG)", icone: "usuario" },
];

const n = (v: number) => v.toLocaleString("pt-BR");

/** Plano da semana (segunda a domingo) com metas que o admin define */
export default function PlanoSemanal({ semana, metas: inicial }: { semana: MetasSemanais & { inicio: string }; metas: MetasSemanais }) {
  const [metas, setMetas] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(inicial);
  const [erro, setErro] = useState("");

  const feitas = ITENS.filter((i) => semana[i.chave] >= metas[i.chave]).length;
  const fim = new Date(Date.parse(semana.inicio) + 7 * 86400_000);
  const diasRestantes = Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 86400_000));

  async function salvar() {
    const { error } = await supabase.from("config").upsert({ chave: "metas_semanais", valor: rascunho });
    if (error) return setErro(error.message);
    setMetas(rascunho);
    setEditando(false);
    setErro("");
  }

  return (
    <section className="cartao p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Icone nome="trofeu" className="size-5 text-marca" /> Plano semanal
            <span className="rounded-full bg-painel-2 px-2 py-0.5 text-xs font-normal text-suave">{diasRestantes} dias restantes</span>
          </h2>
          <p className="text-xs text-suave">{feitas} de {ITENS.length} metas concluídas nesta semana (segunda a domingo).</p>
        </div>
        {editando ? (
          <div className="flex gap-2">
            <button onClick={() => { setEditando(false); setRascunho(metas); }} className="rounded-lg border border-borda px-3 py-1.5 text-sm">Cancelar</button>
            <button onClick={salvar} className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white">Salvar metas</button>
          </div>
        ) : (
          <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 rounded-lg border border-borda px-3 py-1.5 text-sm hover:bg-painel-2">
            <Icone nome="ajustes" className="size-4" /> Editar metas
          </button>
        )}
      </div>
      {erro && <p className="mb-3 text-sm text-red-500">{erro}</p>}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-painel-2">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(feitas / ITENS.length) * 100}%` }} />
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {ITENS.map((i) => {
          const valor = semana[i.chave];
          const meta = metas[i.chave];
          const pct = Math.min(100, (valor / Math.max(1, meta)) * 100);
          return (
            <div key={i.chave}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-suave"><Icone nome={i.icone} className="size-4" /> {i.rotulo}</span>
                {pct >= 100 && !editando && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><Icone nome="check" className="size-3.5" /> Concluída</span>}
              </div>
              {editando ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-suave">Meta:</span>
                  <input
                    type="number"
                    min={0}
                    value={rascunho[i.chave]}
                    onChange={(e) => setRascunho({ ...rascunho, [i.chave]: Math.max(0, Number(e.target.value)) })}
                    className="w-32 rounded-lg border border-borda bg-fundo px-2 py-1.5"
                  />
                </label>
              ) : (
                <>
                  <p className="text-lg font-semibold tabular-nums">
                    {n(valor)} <span className="text-sm font-normal text-suave">/ {n(meta)}</span>
                  </p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-painel-2">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${Math.max(1, pct)}%` }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
