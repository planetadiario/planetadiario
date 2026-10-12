import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { numeroCurto } from "../api";
import Icone from "../Icone";
import IconeRede, { REDES_INFO, type RedeSocial } from "../IconeRede";

interface Dados {
  visitas_hoje: number;
  visitantes_hoje: number;
  visitas: number;
  visitantes: number;
  online: number;
  por_dia: { dia: string; visitas: number; visitantes: number }[];
  origens: { origem: string; visitas: number }[];
  dispositivos: Record<string, number>;
  paginas: { caminho: string; visitas: number; titulo: string | null }[];
  cadastros_total: number;
  cadastros_periodo: number;
  cadastros_hoje: number;
  cadastros_por_dia: { dia: string; n: number }[];
  assinantes: number;
  fundadores: number;
  bot_usuarios: number;
  bot_pro: number;
  recentes: {
    nome: string | null;
    avatar: string | null;
    email: string;
    criado_em: string;
    ultimo_acesso: string | null;
    pontos: number;
    assinante: boolean;
    fundador: number | null;
    comentarios: number;
  }[];
}

const PERIODOS = { "7 dias": 7, "30 dias": 30, "90 dias": 90 } as const;
type Periodo = keyof typeof PERIODOS;

const NOMES_ORIGEM: Record<string, string> = { google: "Google", busca: "Outras buscas", direto: "Direto / link", "outro site": "Outros sites" };
const ICONES_ORIGEM: Record<string, string> = { google: "busca", busca: "busca", direto: "link", "outro site": "globo" };

const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/** Audiência do site: visitas, de onde vêm, o que leem e quem se cadastrou */
export default function Audiencia() {
  const [periodo, setPeriodo] = useState<Periodo>("30 dias");
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setD(null);
    supabase.rpc("painel_audiencia", { p_dias: PERIODOS[periodo] }).then(({ data, error }) => (error ? setErro(error.message) : setD(data as Dados)));
  }, [periodo]);

  if (erro) return <p className="cartao p-4 text-sm text-red-500">{erro}</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">Visitas ao site, de onde vêm os leitores e quem se cadastrou</p>
        <div className="flex rounded-lg border border-borda bg-painel p-0.5 text-sm">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <button key={p} onClick={() => setPeriodo(p)} className={`rounded-md px-3 py-1 ${periodo === p ? "bg-painel-2 font-semibold" : "text-suave hover:text-texto"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {!d ? (
        <div className="cartao h-96 animate-pulse" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Numero icone="pulso" rotulo="Online agora" valor={d.online} destaque />
            <Numero icone="visao" rotulo="Visitas hoje" valor={d.visitas_hoje} />
            <Numero icone="usuario" rotulo="Visitantes hoje" valor={d.visitantes_hoje} />
            <Numero icone="grafico" rotulo={`Visitas (${periodo})`} valor={d.visitas} />
            <Numero icone="usuario" rotulo={`Visitantes (${periodo})`} valor={d.visitantes} />
            <Numero icone="novo" rotulo="Cadastros" valor={d.cadastros_total} extra={`+${d.cadastros_hoje} hoje · +${d.cadastros_periodo} no período`} />
            <Numero icone="estrela" rotulo="Assinantes Pro" valor={d.assinantes} extra={`+${d.bot_pro} Pro no Telegram`} />
            <Numero icone="trofeu" rotulo="Fundadores" valor={d.fundadores} extra={`${d.bot_usuarios} pessoas no bot`} />
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="cartao p-5 lg:col-span-2">
              <h2 className="mb-4 font-semibold">Visitas por dia</h2>
              <Barras dados={d.por_dia.map((x) => ({ rotulo: x.dia, valor: x.visitas, extra: x.visitantes }))} />
            </div>
            <div className="cartao p-5">
              <h2 className="mb-4 font-semibold">De onde vêm os leitores</h2>
              {d.origens.length === 0 ? (
                <p className="text-sm text-suave">Sem visitas ainda.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {d.origens.map((o) => {
                    const total = d.origens.reduce((s, x) => s + x.visitas, 0);
                    const rede = o.origem in REDES_INFO ? (o.origem as RedeSocial) : null;
                    return (
                      <li key={o.origem}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2">
                            {rede ? <IconeRede rede={rede} className="size-4" /> : <Icone nome={ICONES_ORIGEM[o.origem] ?? "globo"} className="size-4 text-suave" />}
                            {rede ? REDES_INFO[rede].nome : NOMES_ORIGEM[o.origem] ?? o.origem}
                          </span>
                          <span className="tabular-nums text-suave">{numeroCurto(o.visitas) || "0"} · {Math.round((o.visitas / total) * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-painel-2">
                          <div className="h-full rounded-full bg-marca" style={{ width: `${(o.visitas / total) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-5 flex gap-3 border-t border-borda pt-4 text-sm">
                {Object.entries(d.dispositivos).map(([k, v]) => (
                  <span key={k} className="flex-1 rounded-lg bg-painel-2 p-2 text-center">
                    <b className="block text-lg tabular-nums">{numeroCurto(v) || "0"}</b>
                    <span className="text-xs capitalize text-suave">{k}</span>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="cartao p-5 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Páginas mais vistas</h2>
              {d.paginas.length === 0 ? (
                <p className="text-sm text-suave">Sem visitas ainda.</p>
              ) : (
                <ol className="flex flex-col">
                  {d.paginas.map((p, i) => (
                    <li key={p.caminho} className="flex items-center gap-3 border-t border-borda py-2 text-sm first:border-0">
                      <span className="w-5 text-xs font-bold text-suave">{i + 1}</span>
                      <a href={p.caminho} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                        {p.titulo ?? (p.caminho === "/" ? "Página inicial" : p.caminho)}
                      </a>
                      <span className="font-semibold tabular-nums">{numeroCurto(p.visitas) || "0"}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="cartao p-5">
              <h2 className="mb-4 font-semibold">Cadastros por dia</h2>
              <Barras dados={d.cadastros_por_dia.map((x) => ({ rotulo: x.dia, valor: x.n }))} cor="bg-emerald-500" />
            </div>
          </section>

          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold">Cadastros recentes</h2>
            {d.recentes.length === 0 ? (
              <p className="text-sm text-suave">Ninguém se cadastrou ainda.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-suave">
                      <th className="pb-2 font-medium">Leitor</th>
                      <th className="pb-2 font-medium">Cadastro</th>
                      <th className="pb-2 font-medium">Último acesso</th>
                      <th className="pb-2 text-right font-medium">Pontos</th>
                      <th className="pb-2 text-right font-medium">Comentários</th>
                      <th className="pb-2 text-right font-medium">Plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentes.map((u) => (
                      <tr key={u.email} className="border-t border-borda">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-3">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
                            ) : (
                              <span className="grid size-8 place-items-center rounded-full bg-painel-2 text-xs font-bold">{(u.nome ?? "?")[0]}</span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{u.nome ?? "Sem nome"}</span>
                              <span className="block truncate text-xs text-suave">{u.email}</span>
                            </span>
                          </div>
                        </td>
                        <td className="text-suave">{data(u.criado_em)}</td>
                        <td className="text-suave">{data(u.ultimo_acesso)}</td>
                        <td className="text-right tabular-nums">{u.pontos}</td>
                        <td className="text-right tabular-nums">{u.comentarios}</td>
                        <td className="text-right">
                          {u.fundador ? (
                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-500">Fundador nº {u.fundador}</span>
                          ) : u.assinante ? (
                            <span className="rounded-full bg-marca/15 px-2 py-0.5 text-xs font-semibold text-marca">Pro</span>
                          ) : (
                            <span className="text-xs text-suave">Grátis</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Numero({ icone, rotulo, valor, extra, destaque }: { icone: string; rotulo: string; valor: number; extra?: string; destaque?: boolean }) {
  return (
    <div className="cartao flex flex-col gap-1.5 p-4">
      <span className="flex items-center gap-1.5 text-xs text-suave">
        {destaque ? <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> : <Icone nome={icone} className="size-3.5" />} {rotulo}
      </span>
      <b className="text-2xl tabular-nums">{valor.toLocaleString("pt-BR")}</b>
      {extra && <span className="text-[11px] text-suave">{extra}</span>}
    </div>
  );
}

/** Barras verticais simples por dia (passe o mouse para ver o número) */
function Barras({ dados, cor = "bg-marca" }: { dados: { rotulo: string; valor: number; extra?: number }[]; cor?: string }) {
  if (!dados.length) return <p className="text-sm text-suave">Sem dados no período.</p>;
  const max = Math.max(1, ...dados.map((x) => x.valor));
  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {dados.map((x) => (
          <div key={x.rotulo} className="group relative flex h-full flex-1 items-end">
            <div className={`w-full rounded-t ${cor} opacity-80 transition group-hover:opacity-100`} style={{ height: `${Math.max(2, (x.valor / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-painel-2 px-2 py-1 text-xs shadow group-hover:block">
              {new Date(`${x.rotulo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: {x.valor}
              {x.extra != null ? ` (${x.extra} pessoas)` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-suave">
        <span>{new Date(`${dados[0].rotulo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
        <span>{new Date(`${dados.at(-1)!.rotulo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
      </div>
    </div>
  );
}
