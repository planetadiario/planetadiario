import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Abas from "../Abas";
import Icone from "../Icone";

type Aba = "resumo" | "lista" | "votacoes" | "config";

interface Fundador {
  id: string;
  numero: number | null;
  status: string;
  valor_centavos: number;
  nome_mural: string | null;
  pago_em: string | null;
  criado_em: string;
}
interface Enquete {
  id: string;
  pergunta: string;
  opcoes: string[];
  aberta: boolean;
  votos: number[];
  total: number;
}

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => `#${String(n).padStart(5, "0")}`;

export default function Fundadores() {
  const [aba, setAba] = useState<Aba>("resumo");
  const [lista, setLista] = useState<Fundador[]>([]);
  const [cfg, setCfg] = useState<{ preco: number; meta: number; dias: number } | null>(null);

  const carregar = () =>
    supabase.from("fundadores").select("*").order("criado_em", { ascending: false }).limit(1000).then(({ data }) => setLista((data as Fundador[]) ?? []));

  useEffect(() => {
    carregar();
    supabase
      .from("config")
      .select("chave, valor")
      .in("chave", ["fundador_preco_centavos", "fundador_meta", "fundador_dias_pro"])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((c) => [c.chave, Number(c.valor)]));
        setCfg({ preco: m.fundador_preco_centavos ?? 1590, meta: m.fundador_meta ?? 63000, dias: m.fundador_dias_pro ?? 30 });
      });
  }, []);

  const ativos = lista.filter((f) => f.status === "ativo");
  const arrecadado = ativos.reduce((s, f) => s + f.valor_centavos, 0);
  const metaReais = cfg ? cfg.meta * cfg.preco : 0;
  const hoje = ativos.filter((f) => f.pago_em && Date.now() - Date.parse(f.pago_em) < 86400_000).length;

  return (
    <div>
      <Abas<Aba>
        atual={aba}
        aoTrocar={setAba}
        abas={[
          { id: "resumo", nome: "Resumo", icone: "visao" },
          { id: "lista", nome: "Fundadores", icone: "usuario", contagem: ativos.length },
          { id: "votacoes", nome: "Votações", icone: "checkCirculo" },
          { id: "config", nome: "Configuração", icone: "ajustes" },
        ]}
      />

      {aba === "resumo" && cfg && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi rotulo="Fundadores" valor={ativos.length.toLocaleString("pt-BR")} icone="usuario" />
            <Kpi rotulo="Arrecadado" valor={reais(arrecadado)} icone="grafico" />
            <Kpi rotulo="Novos nas últimas 24 h" valor={String(hoje)} icone="raio" />
            <Kpi rotulo="Pagamentos pendentes" valor={String(lista.filter((f) => f.status === "pendente").length)} icone="recarregar" />
          </div>
          <section className="cartao p-6">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>Meta: <b>{cfg.meta.toLocaleString("pt-BR")}</b> fundadores ({reais(metaReais)})</span>
              <b>{((arrecadado / Math.max(1, metaReais)) * 100).toFixed(2)}%</b>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-painel-2">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-marca" style={{ width: `${Math.max(0.5, (arrecadado / Math.max(1, metaReais)) * 100)}%` }} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Pioneiros (1–1.000)", ativos.filter((f) => (f.numero ?? 0) <= 1000).length, 1000],
                ["Fundadores (1.001–10.000)", ativos.filter((f) => (f.numero ?? 0) > 1000 && (f.numero ?? 0) <= 10000).length, 9000],
                ["Apoiadores (10.001+)", ativos.filter((f) => (f.numero ?? 0) > 10000).length, null],
              ].map(([nome, n, vagas]) => (
                <div key={nome as string} className="rounded-lg bg-painel-2 p-3 text-sm">
                  <p className="text-suave">{nome}</p>
                  <p className="text-lg font-semibold">{(n as number).toLocaleString("pt-BR")}{vagas ? <span className="text-sm font-normal text-suave"> / {(vagas as number).toLocaleString("pt-BR")}</span> : null}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {aba === "lista" && (
        <section className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-suave">
                <th className="p-3 font-medium">Número</th>
                <th className="p-3 font-medium">Nome no mural</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Valor</th>
                <th className="p-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className="border-b border-borda last:border-0">
                  <td className="p-3 font-semibold tabular-nums">{f.numero ? num(f.numero) : "—"}</td>
                  <td className="p-3">{f.nome_mural ?? "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${f.status === "ativo" ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2 text-suave"}`}>{f.status}</span>
                  </td>
                  <td className="p-3 tabular-nums">{reais(f.valor_centavos)}</td>
                  <td className="p-3 text-suave">{new Date(f.pago_em ?? f.criado_em).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-suave">Ainda não há fundadores.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {aba === "votacoes" && <Votacoes />}

      {aba === "config" && cfg && (
        <section className="cartao grid max-w-3xl gap-5 p-6 sm:grid-cols-3">
          <Campo rotulo="Preço (R$)" valor={(cfg.preco / 100).toFixed(2)} passo={0.1} salvar={(v) => gravar("fundador_preco_centavos", Math.round(v * 100))} />
          <Campo rotulo="Meta de fundadores" valor={String(cfg.meta)} passo={1} salvar={(v) => gravar("fundador_meta", Math.round(v))} />
          <Campo rotulo="Dias de Pro de presente" valor={String(cfg.dias)} passo={1} salvar={(v) => gravar("fundador_dias_pro", Math.round(v))} />
        </section>
      )}
    </div>
  );

  async function gravar(chave: string, valor: number) {
    await supabase.from("config").upsert({ chave, valor });
    setCfg((c) =>
      c ? { ...c, ...(chave === "fundador_preco_centavos" ? { preco: valor } : chave === "fundador_meta" ? { meta: valor } : { dias: valor }) } : c,
    );
  }
}

function Votacoes() {
  const [enquetes, setEnquetes] = useState<Enquete[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [erro, setErro] = useState("");

  const carregar = () => supabase.rpc("resultado_enquetes").then(({ data }) => setEnquetes(data ?? []));
  useEffect(() => {
    carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const ops = opcoes.map((o) => o.trim()).filter(Boolean);
    const { error } = await supabase.from("enquetes").insert({ pergunta: pergunta.trim(), opcoes: ops });
    if (error) return setErro(error.message);
    setPergunta("");
    setOpcoes(["", ""]);
    carregar();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      <form onSubmit={criar} className="cartao flex flex-col gap-3 p-5 xl:self-start">
        <h3 className="font-semibold">Nova votação de pauta</h3>
        <input required minLength={5} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: Qual tema devemos cobrir mais?" className="rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm" />
        {opcoes.map((o, i) => (
          <input
            key={i}
            value={o}
            onChange={(e) => setOpcoes(opcoes.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Opção ${i + 1}`}
            className="rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
          />
        ))}
        {opcoes.length < 6 && (
          <button type="button" onClick={() => setOpcoes([...opcoes, ""])} className="flex items-center gap-1 text-sm text-suave hover:text-texto">
            <Icone nome="novo" className="size-4" /> Adicionar opção
          </button>
        )}
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <button className="rounded-lg bg-marca py-2.5 font-semibold text-white">Abrir votação</button>
      </form>
      <div className="flex flex-col gap-4">
        {enquetes.map((e) => (
          <section key={e.id} className="cartao p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="font-semibold">{e.pergunta}</h3>
              <button
                onClick={() => supabase.from("enquetes").update({ aberta: !e.aberta }).eq("id", e.id).then(carregar)}
                className="shrink-0 rounded-lg border border-borda px-3 py-1 text-xs hover:bg-painel-2"
              >
                {e.aberta ? "Encerrar" : "Reabrir"}
              </button>
            </div>
            {e.opcoes.map((o, i) => {
              const pct = e.total ? Math.round((e.votos[i] / e.total) * 100) : 0;
              return (
                <div key={i} className="mb-2 text-sm">
                  <div className="mb-1 flex justify-between"><span>{o}</span><b className="tabular-nums">{e.votos[i]} · {pct}%</b></div>
                  <div className="h-2 rounded-full bg-painel-2"><div className="h-2 rounded-full bg-marca" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
            <p className="text-xs text-suave">{e.total} votos · {e.aberta ? "aberta" : "encerrada"}</p>
          </section>
        ))}
        {enquetes.length === 0 && <p className="cartao p-8 text-center text-sm text-suave">Nenhuma votação criada ainda.</p>}
      </div>
    </div>
  );
}

function Kpi({ rotulo, valor, icone }: { rotulo: string; valor: string; icone: string }) {
  return (
    <div className="cartao flex flex-col gap-2 p-4">
      <span className="flex items-center gap-2 text-sm text-suave">
        <span className="grid size-8 place-items-center rounded-lg bg-marca/10 text-marca"><Icone nome={icone} className="size-4" /></span>
        {rotulo}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{valor}</span>
    </div>
  );
}

function Campo({ rotulo, valor, passo, salvar }: { rotulo: string; valor: string; passo: number; salvar: (v: number) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-suave">{rotulo}</span>
      <input type="number" step={passo} defaultValue={valor} onBlur={(e) => salvar(Number(e.target.value))} className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5" />
    </label>
  );
}
