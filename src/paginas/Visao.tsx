import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { numeroCurto } from "../api";

interface Metricas {
  fb_curtidas: number;
  fb_comentarios: number;
  ig_curtidas: number;
  ig_comentarios: number;
}
interface ReelPub {
  id: string;
  categoria: string;
  manchete: string | null;
  thumb_url: string | null;
  fb_post_url: string | null;
  ig_post_url: string | null;
  publicado_em: string;
  metricas: Metricas | null;
}

const PERIODOS = { "7 dias": 7, "30 dias": 30, "90 dias": 90 } as const;
type Periodo = keyof typeof PERIODOS;
const DIA = 86400_000;

const eng = (m: Metricas | null) => (m ? m.fb_curtidas + m.fb_comentarios + m.ig_curtidas + m.ig_comentarios : 0);

export default function Visao() {
  const [periodo, setPeriodo] = useState<Periodo>("30 dias");
  const [reels, setReels] = useState<ReelPub[]>([]);
  const [fila, setFila] = useState({ producao: 0, prontos: 0, erros: 0 });

  useEffect(() => {
    const desde = new Date(Date.now() - 2 * PERIODOS[periodo] * DIA).toISOString();
    supabase
      .from("reels")
      .select("id, categoria, manchete, thumb_url, fb_post_url, ig_post_url, publicado_em, metricas")
      .eq("status", "publicado")
      .gte("publicado_em", desde)
      .order("publicado_em")
      .then(({ data }) => setReels((data as ReelPub[]) ?? []));
  }, [periodo]);

  useEffect(() => {
    const contar = (st: string[]) =>
      supabase.from("reels").select("id", { count: "exact", head: true }).in("status", st).then((r) => r.count ?? 0);
    Promise.all([contar(["na_fila", "processando", "publicando"]), contar(["pronto"]), contar(["erro"])]).then(
      ([producao, prontos, erros]) => setFila({ producao, prontos, erros }),
    );
  }, []);

  const d = useMemo(() => {
    const dias = PERIODOS[periodo];
    const corte = Date.now() - dias * DIA;
    const atual = reels.filter((r) => new Date(r.publicado_em).getTime() >= corte);
    const anterior = reels.filter((r) => new Date(r.publicado_em).getTime() < corte);
    const soma = (rs: ReelPub[], k: keyof Metricas) => rs.reduce((s, r) => s + (r.metricas?.[k] ?? 0), 0);
    const kpi = (rs: ReelPub[]) => ({
      posts: rs.length,
      curtidas: soma(rs, "fb_curtidas") + soma(rs, "ig_curtidas"),
      comentarios: soma(rs, "fb_comentarios") + soma(rs, "ig_comentarios"),
      engajamento: rs.reduce((s, r) => s + eng(r.metricas), 0),
    });

    const serie = Array.from({ length: dias }, (_, i) => {
      const ini = new Date(corte + i * DIA);
      ini.setHours(0, 0, 0, 0);
      const fim = ini.getTime() + DIA;
      const doDia = atual.filter((r) => {
        const t = new Date(r.publicado_em).getTime();
        return t >= ini.getTime() && t < fim;
      });
      return { dia: ini, valor: doDia.reduce((s, r) => s + eng(r.metricas), 0), posts: doDia.length };
    });

    const porCat = new Map<string, number>();
    atual.forEach((r) => porCat.set(r.categoria, (porCat.get(r.categoria) ?? 0) + 1));

    return {
      atual: kpi(atual),
      anterior: kpi(anterior),
      serie,
      fb: soma(atual, "fb_curtidas") + soma(atual, "fb_comentarios"),
      ig: soma(atual, "ig_curtidas") + soma(atual, "ig_comentarios"),
      categorias: [...porCat.entries()].sort((a, b) => b[1] - a[1]),
      top: [...atual].sort((a, b) => eng(b.metricas) - eng(a.metricas)).slice(0, 5),
    };
  }, [reels, periodo]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">Desempenho dos Reels publicados no Facebook e no Instagram</p>
        <div className="flex rounded-lg border border-borda bg-painel p-0.5 text-sm">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-md px-3 py-1 ${periodo === p ? "bg-painel-2 font-semibold" : "text-suave hover:text-texto"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icone="producao" rotulo="Reels publicados" valor={d.atual.posts} antes={d.anterior.posts} />
        <Kpi icone="curtida" rotulo="Curtidas" valor={d.atual.curtidas} antes={d.anterior.curtidas} />
        <Kpi icone="comentario" rotulo="Comentários" valor={d.atual.comentarios} antes={d.anterior.comentarios} />
        <Kpi icone="raio" rotulo="Engajamento total" valor={d.atual.engajamento} antes={d.anterior.engajamento} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="cartao p-5 lg:col-span-2">
          <h2 className="font-semibold">Engajamento ao longo do tempo</h2>
          <p className="mb-4 text-xs text-suave">Curtidas + comentários dos Reels publicados em cada dia</p>
          <GraficoLinha serie={d.serie} />
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold">Por plataforma</h2>
          <p className="mb-5 text-xs text-suave">Engajamento no período</p>
          <Plataformas fb={d.fb} ig={d.ig} />
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-borda pt-4 text-center">
            <Mini rotulo="Em produção" valor={fila.producao} />
            <Mini rotulo="Prontos" valor={fila.prontos} />
            <Mini rotulo="Com erro" valor={fila.erros} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="cartao p-5">
          <h2 className="mb-4 font-semibold">Reels por categoria</h2>
          {d.categorias.length === 0 ? (
            <Vazio />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d.categorias.map(([cat, n]) => (
                <li key={cat} className="grid grid-cols-[96px_1fr_32px] items-center gap-3 text-sm" title={`${cat}: ${n} reels`}>
                  <span className="truncate text-xs font-semibold uppercase text-suave">{cat}</span>
                  <span className="h-2 rounded-full bg-painel-2">
                    <span className="block h-2 rounded-full bg-marca" style={{ width: `${(n / d.categorias[0][1]) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cartao p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Melhores Reels</h2>
          {d.top.length === 0 ? (
            <Vazio />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-suave">
                  <th className="pb-2 font-medium">Reel</th>
                  <th className="pb-2 text-right font-medium text-fb">Facebook</th>
                  <th className="pb-2 text-right font-medium text-ig">Instagram</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.top.map((r) => (
                  <tr key={r.id} className="border-t border-borda">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        {r.thumb_url ? (
                          <img src={r.thumb_url} alt="" className="h-12 w-7 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="h-12 w-7 shrink-0 rounded bg-painel-2" />
                        )}
                        <span className="line-clamp-2">{r.manchete ?? "—"}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">
                      {r.fb_post_url ? <a href={r.fb_post_url} target="_blank" rel="noreferrer" className="hover:underline">{numeroCurto((r.metricas?.fb_curtidas ?? 0) + (r.metricas?.fb_comentarios ?? 0)) || "0"}</a> : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.ig_post_url ? <a href={r.ig_post_url} target="_blank" rel="noreferrer" className="hover:underline">{numeroCurto((r.metricas?.ig_curtidas ?? 0) + (r.metricas?.ig_comentarios ?? 0)) || "0"}</a> : "—"}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{numeroCurto(eng(r.metricas)) || "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ icone, rotulo, valor, antes }: { icone: string; rotulo: string; valor: number; antes: number }) {
  const delta = antes > 0 ? Math.round(((valor - antes) / antes) * 100) : null;
  return (
    <div className="cartao flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm text-suave">
        <span className="grid size-8 place-items-center rounded-lg bg-marca/10 text-marca">
          <Icone nome={icone} className="size-4" />
        </span>
        {rotulo}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold tabular-nums">{numeroCurto(valor) || "0"}</span>
        {delta !== null && (
          <span className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            <span className="flex items-center gap-0.5"><Icone nome={delta >= 0 ? "cima" : "baixo"} className="size-3.5" />{Math.abs(delta)}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-suave">{rotulo}</p>
    </div>
  );
}

function Vazio() {
  return <p className="py-6 text-center text-sm text-suave">Os dados aparecem aqui depois das primeiras publicações.</p>;
}

function Plataformas({ fb, ig }: { fb: number; ig: number }) {
  const total = fb + ig;
  const itens = [
    { nome: "Facebook", valor: fb, cor: "bg-fb" },
    { nome: "Instagram", valor: ig, cor: "bg-ig" },
  ];
  return (
    <div>
      <p className="mb-3 text-3xl font-semibold tabular-nums">{numeroCurto(total) || "0"}</p>
      <div className="mb-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-painel-2">
        {total > 0 &&
          itens.map((i) => <span key={i.nome} className={`${i.cor} h-full`} style={{ width: `${(i.valor / total) * 100}%` }} title={`${i.nome}: ${i.valor}`} />)}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${i.cor}`} />
            <span className="text-suave">{i.nome}</span>
            <span className="ml-auto font-medium tabular-nums">{numeroCurto(i.valor) || "0"}</span>
            <span className="w-10 text-right text-xs text-suave">{total ? Math.round((i.valor / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GraficoLinha({ serie }: { serie: { dia: Date; valor: number; posts: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, PX = 36, PY = 16;
  const max = Math.max(1, ...serie.map((s) => s.valor));
  const teto = Math.pow(10, Math.floor(Math.log10(max))) * Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max))));
  const x = (i: number) => PX + (i * (W - PX - 8)) / Math.max(1, serie.length - 1);
  const y = (v: number) => H - PY - (v / teto) * (H - 2 * PY);
  const linha = serie.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s.valor)}`).join("");
  const area = `${linha}L${x(serie.length - 1)},${H - PY}L${x(0)},${H - PY}Z`;
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const marcas = [0, Math.floor((serie.length - 1) / 2), serie.length - 1];
  const h = hover !== null ? serie[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Engajamento por dia"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(serie.length - 1, Math.round(((px - PX) / (W - PX - 8)) * (serie.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--marca)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--marca)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PX} x2={W - 8} y1={y(teto * f)} y2={y(teto * f)} stroke="var(--borda)" strokeDasharray={f ? "3 4" : undefined} />
            <text x={PX - 8} y={y(teto * f) + 4} textAnchor="end" fontSize="11" fill="var(--suave)">{numeroCurto(teto * f) || "0"}</text>
          </g>
        ))}
        {marcas.map((i) => (
          <text key={i} x={x(i)} y={H - 1} textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--suave)">
            {fmt(serie[i].dia)}
          </text>
        ))}
        <path d={area} fill="url(#gArea)" />
        <path d={linha} fill="none" stroke="var(--marca)" strokeWidth="2" strokeLinejoin="round" />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PY} y2={H - PY} stroke="var(--suave)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.valor)} r="5" fill="var(--marca)" stroke="var(--painel)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-borda bg-painel px-3 py-2 text-xs shadow-cartao"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > serie.length / 2 ? "-105%" : "5%"})` }}
        >
          <p className="font-semibold">{fmt(h.dia)}</p>
          <p className="text-suave">
            <b className="text-texto tabular-nums">{h.valor}</b> de engajamento · {h.posts} reel{h.posts === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
