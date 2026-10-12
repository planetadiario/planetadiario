import { useEffect, useState } from "react";
import { api } from "../api";
import Icone from "../Icone";
import PlanoSemanal, { type MetasSemanais } from "./PlanoSemanal";

interface Dados {
  metas: { seguidores: number; minutos_60d: number; reels_30d: number };
  seguidores: { dia: string; fb: number; ig: number } | null;
  historico: { dia: string; fb: number; ig: number }[];
  minutos_60d: { fb: number; ig: number };
  reels_30d: number;
  reels_hoje: number;
  semana: MetasSemanais & { inicio: string };
  metas_semanais: MetasSemanais;
}

const n = (v: number) => v.toLocaleString("pt-BR");

/** Quanto falta para monetizar no Facebook (metas de referência; as exatas ficam no Painel Profissional) */
export default function MetasMonetizacao() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api<Dados>("/monetizacao").then(setD).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <p className="cartao p-4 text-sm text-red-500">Metas: {erro}</p>;
  if (!d) return <div className="cartao h-44 animate-pulse" />;

  const fb = d.seguidores?.fb ?? 0;
  const ganho7 = (() => {
    const h = d.historico;
    if (h.length < 2) return null;
    const antigo = h[Math.max(0, h.length - 8)];
    return fb - antigo.fb;
  })();
  const metas = [
    { rotulo: "Seguidores no Facebook", valor: fb, meta: d.metas.seguidores, icone: "usuario", extra: ganho7 != null ? `+${n(ganho7)} em 7 dias · Instagram: ${n(d.seguidores?.ig ?? 0)}` : `Instagram: ${n(d.seguidores?.ig ?? 0)}` },
    { rotulo: "Minutos assistidos (60 dias)", valor: d.minutos_60d.fb, meta: d.metas.minutos_60d, icone: "video", extra: `Instagram: ${n(d.minutos_60d.ig)} min` },
    { rotulo: "Reels publicados (30 dias)", valor: d.reels_30d, meta: d.metas.reels_30d, icone: "reels", extra: `${d.reels_hoje} hoje` },
  ];
  const prontas = metas.filter((m) => m.valor >= m.meta).length;

  return (
    <>
    <PlanoSemanal semana={d.semana} metas={d.metas_semanais} />
    <section className="cartao p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Icone nome="grafico" className="size-5 text-marca" /> Metas de monetização do Facebook</h2>
          <p className="text-xs text-suave">Referência; a Meta muda os critérios. Confirme no Painel Profissional → Monetização.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${prontas === metas.length ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2"}`}>
          {prontas}/{metas.length} metas atingidas
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {metas.map((m) => {
          const pct = Math.min(100, (m.valor / Math.max(1, m.meta)) * 100);
          const falta = Math.max(0, m.meta - m.valor);
          return (
            <div key={m.rotulo}>
              <p className="mb-1 flex items-center gap-2 text-sm text-suave"><Icone nome={m.icone} className="size-4" /> {m.rotulo}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {n(m.valor)} <span className="text-sm font-normal text-suave">/ {n(m.meta)}</span>
              </p>
              <div className="my-2 h-2.5 overflow-hidden rounded-full bg-painel-2">
                <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${Math.max(1, pct)}%` }} />
              </div>
              <p className="text-xs text-suave">{falta > 0 ? `Faltam ${n(falta)} · ` : "Meta atingida · "}{m.extra}</p>
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
