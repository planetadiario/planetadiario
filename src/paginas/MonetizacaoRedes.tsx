import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api, numeroCurto } from "../api";
import Icone from "../Icone";
import IconeRede, { REDES_INFO, type RedeSocial } from "../IconeRede";

interface Seguidores {
  atual: number | null;
  ganho7: number | null;
  serie: { dia: string; v: number }[];
}
type Numeros = Record<string, number | null | Seguidores> & { seguidores: Seguidores };
interface Dados {
  metas: Record<string, Record<string, number>>;
  redes: Record<RedeSocial, Numeros>;
}

interface Meta {
  chave: string; // chave em metas_redes
  rotulo: string;
  valor: (n: Numeros) => number | null;
}

/** Programa de monetização de cada rede e o que conta para ele (referência; os critérios mudam) */
const PROGRAMAS: Record<RedeSocial, { programa: string; nota: string; metas: Meta[]; extras: { rotulo: string; valor: (n: Numeros) => string }[] }> = {
  facebook: {
    programa: "Monetização de conteúdo do Facebook",
    nota: "Confirme no Painel profissional → Monetização. Página nova desde 12/10.",
    metas: [
      { chave: "seguidores", rotulo: "Seguidores", valor: (n) => n.seguidores.atual },
      { chave: "minutos_60d", rotulo: "Minutos assistidos (60 dias)", valor: (n) => n.minutos_60d as number },
    ],
    extras: [
      { rotulo: "Views (30 dias)", valor: (n) => numeroCurto(n.views_30d as number) || "0" },
      { rotulo: "Reels (30 dias)", valor: (n) => String(n.posts_30d) },
    ],
  },
  instagram: {
    programa: "Assinaturas, presentes e bônus do Instagram",
    nota: "Assinaturas pedem 10 mil seguidores. Views altas também atraem parcerias pagas.",
    metas: [
      { chave: "seguidores", rotulo: "Seguidores", valor: (n) => n.seguidores.atual },
      { chave: "views_30d", rotulo: "Views (30 dias)", valor: (n) => n.views_30d as number },
    ],
    extras: [
      { rotulo: "Alcance (30 dias)", valor: (n) => numeroCurto(n.alcance_30d as number) || "0" },
      { rotulo: "Minutos assistidos (60 dias)", valor: (n) => numeroCurto(n.minutos_60d as number) || "0" },
      { rotulo: "Reels (30 dias)", valor: (n) => String(n.posts_30d) },
    ],
  },
  youtube: {
    programa: "Programa de Parcerias do YouTube (Shorts)",
    nota: "Receita de anúncios: 1.000 inscritos + 10 mi de views de Shorts em 90 dias. Nível inicial (assinaturas, Super Thanks): 500 inscritos + 3 mi de views.",
    metas: [
      { chave: "inscritos", rotulo: "Inscritos", valor: (n) => n.seguidores.atual },
      { chave: "views_90d", rotulo: "Views de Shorts (90 dias)", valor: (n) => n.views_90d as number },
    ],
    extras: [
      { rotulo: "Views (30 dias)", valor: (n) => numeroCurto(n.views_30d as number) || "0" },
      { rotulo: "Shorts (90 dias)", valor: (n) => String(n.posts_90d) },
    ],
  },
  tiktok: {
    programa: "Creator Rewards do TikTok",
    nota: "10 mil seguidores + 100 mil views em 30 dias, com vídeos de mais de 1 minuto. Os números chegam depois da aprovação do app.",
    metas: [
      { chave: "seguidores", rotulo: "Seguidores", valor: (n) => n.seguidores.atual },
      { chave: "views_30d", rotulo: "Views (30 dias)", valor: (n) => n.views_30d as number | null },
    ],
    extras: [{ rotulo: "Vídeos (30 dias)", valor: (n) => String(n.posts_30d) }],
  },
  telegram: {
    programa: "Anúncios do Telegram + vendas pelo bot",
    nota: "Canais com 1.000 inscritos entram na divisão de receita de anúncios. Pro e Fundadores vendidos pelo bot já entram em caixa.",
    metas: [{ chave: "inscritos", rotulo: "Inscritos no canal", valor: (n) => n.seguidores.atual }],
    extras: [
      { rotulo: "Receita do bot", valor: (n) => ((n.receita_bot as number) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
      { rotulo: "Vendas no bot", valor: (n) => String(n.vendas_bot) },
      { rotulo: "Posts (30 dias)", valor: (n) => String(n.posts_30d) },
    ],
  },
  threads: {
    programa: "Sem monetização direta",
    nota: "O Threads serve para levar leitores ao site (anúncios e assinaturas). Seguidores aparecem após reconectar a conta.",
    metas: [{ chave: "seguidores", rotulo: "Seguidores", valor: (n) => n.seguidores.atual }],
    extras: [{ rotulo: "Posts (30 dias)", valor: (n) => String(n.posts_30d) }],
  },
};

const ORDEM: RedeSocial[] = ["facebook", "instagram", "youtube", "tiktok", "telegram", "threads"];
const fmt = (v: number) => v.toLocaleString("pt-BR");

function progresso(rede: RedeSocial, d: Dados) {
  const ms = PROGRAMAS[rede].metas.map((m) => {
    const v = m.valor(d.redes[rede]);
    const meta = d.metas[rede]?.[m.chave] ?? 0;
    return v == null || !meta ? null : Math.min(100, (v / meta) * 100);
  });
  const validos = ms.filter((x): x is number => x != null);
  return validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
}

/** Monetização por rede: um cartão por rede e o detalhe das metas da rede escolhida */
export default function MonetizacaoRedes() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState<RedeSocial>("instagram");
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, number>>({});

  useEffect(() => {
    api<Dados>("/monetizacao/redes").then(setD).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <p className="cartao p-4 text-sm text-red-500">Monetização: {erro}</p>;
  if (!d) return <div className="cartao h-64 animate-pulse" />;

  const prog = PROGRAMAS[sel];
  const numeros = d.redes[sel];

  async function salvar() {
    const metas = { ...d!.metas, [sel]: { ...d!.metas[sel], ...rascunho } };
    const { error } = await supabase.from("config").upsert({ chave: "metas_redes", valor: metas });
    if (error) return setErro(error.message);
    setD({ ...d!, metas });
    setEditando(false);
  }

  return (
    <section className="cartao p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-semibold"><Icone nome="grafico" className="size-5 text-marca" /> Monetização por rede</h2>
        <p className="text-xs text-suave">Cada rede tem o seu programa e as suas metas. Clique numa rede para ver o detalhe.</p>
      </div>

      {/* resumo: um cartão por rede */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ORDEM.map((rede) => {
          const n = d.redes[rede];
          const p = progresso(rede, d);
          const ativo = rede === sel;
          return (
            <button
              key={rede}
              onClick={() => { setSel(rede); setEditando(false); }}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition ${ativo ? "border-marca bg-painel-2" : "border-borda hover:bg-painel-2"}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <IconeRede rede={rede} className="size-5" /> {REDES_INFO[rede].nome}
              </span>
              <span className="text-xl font-semibold tabular-nums">{n.seguidores.atual != null ? numeroCurto(n.seguidores.atual) || "0" : "—"}</span>
              <span className="text-xs text-suave">
                {n.seguidores.ganho7 != null ? `${n.seguidores.ganho7 >= 0 ? "+" : ""}${fmt(n.seguidores.ganho7)} em 7 dias` : rede === "youtube" || rede === "telegram" ? "inscritos" : "seguidores"}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-fundo">
                <span className={`block h-full rounded-full ${p != null && p >= 100 ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${Math.max(2, p ?? 0)}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      {/* detalhe da rede escolhida */}
      <div className="mt-5 grid gap-5 border-t border-borda pt-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold"><IconeRede rede={sel} className="size-5" /> {prog.programa}</p>
              <p className="mt-0.5 max-w-xl text-xs text-suave">{prog.nota}</p>
            </div>
            {editando ? (
              <div className="flex gap-2">
                <button onClick={() => setEditando(false)} className="rounded-lg border border-borda px-3 py-1.5 text-sm">Cancelar</button>
                <button onClick={salvar} className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white">Salvar</button>
              </div>
            ) : (
              <button
                onClick={() => { setRascunho({ ...d.metas[sel] }); setEditando(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-borda px-3 py-1.5 text-sm hover:bg-painel-2"
              >
                <Icone nome="ajustes" className="size-4" /> Editar metas
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {prog.metas.map((m) => {
              const v = m.valor(numeros);
              const meta = d.metas[sel]?.[m.chave] ?? 0;
              const pct = v == null || !meta ? 0 : Math.min(100, (v / meta) * 100);
              return (
                <div key={m.chave}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-suave">{m.rotulo}</span>
                    {editando ? (
                      <input
                        type="number"
                        min={0}
                        value={rascunho[m.chave] ?? 0}
                        onChange={(e) => setRascunho({ ...rascunho, [m.chave]: Math.max(0, Number(e.target.value)) })}
                        className="w-36 rounded-lg border border-borda bg-fundo px-2 py-1 text-right"
                      />
                    ) : (
                      <span className="tabular-nums">
                        <b className="text-base">{v == null ? "sem dados" : fmt(v)}</b> <span className="text-suave">/ {fmt(meta)}</span>
                      </span>
                    )}
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-painel-2">
                    <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${Math.max(1, pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-suave">
                    {v == null ? "Ainda sem leitura automática desta rede." : pct >= 100 ? "Meta atingida" : `Faltam ${fmt(Math.max(0, meta - v))} · ${pct.toFixed(pct < 10 ? 1 : 0)}%`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Serie serie={numeros.seguidores.serie} />
          <div className="grid grid-cols-2 gap-3">
            {prog.extras.map((e) => (
              <div key={e.rotulo} className="rounded-lg bg-painel-2 p-3">
                <p className="text-xs text-suave">{e.rotulo}</p>
                <p className="text-lg font-semibold tabular-nums">{e.valor(numeros)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mini gráfico de seguidores dos últimos 30 dias */
function Serie({ serie }: { serie: { dia: string; v: number }[] }) {
  if (serie.length < 2) {
    return <div className="flex h-24 items-center justify-center rounded-lg bg-painel-2 text-xs text-suave">O gráfico aparece com 2 dias de dados</div>;
  }
  const min = Math.min(...serie.map((s) => s.v));
  const max = Math.max(...serie.map((s) => s.v));
  const pts = serie.map((s, i) => `${(i / (serie.length - 1)) * 100},${36 - ((s.v - min) / Math.max(1, max - min)) * 32}`).join(" ");
  return (
    <div className="rounded-lg bg-painel-2 p-3">
      <p className="mb-1 text-xs text-suave">Seguidores (30 dias)</p>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full">
        <polyline points={pts} fill="none" stroke="var(--marca)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
