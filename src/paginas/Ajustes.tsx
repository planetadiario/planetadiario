import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api, type Categoria } from "../api";
import Abas from "../Abas";
import Icone from "../Icone";

interface Aprendizados {
  texto?: string;
  aprendizados?: string[];
  categorias_fortes?: string[];
  categorias_fracas?: string[];
  base?: number;
  atualizado_em?: string | null;
}

interface Cfg {
  publicacao_automatica: boolean;
  score_minimo_auto: number;
  max_posts_dia: number;
  paises: string[];
  fontes_bloqueadas: string[];
  rodape: string;
  assinatura_preco_centavos: number;
  acesso_antecipado_min: number;
  aprendizados: Aprendizados;
}

type Aba = "automacao" | "inteligencia" | "categorias" | "reel" | "fontes" | "site";

export default function Ajustes() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [salvo, setSalvo] = useState("");
  const [aba, setAba] = useState<Aba>("automacao");

  useEffect(() => {
    supabase.from("config").select("*").then(({ data }) => setCfg(Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor])) as Cfg));
    supabase.from("categorias").select("*").order("ordem").then(({ data }) => setCategorias(data ?? []));
  }, []);

  async function gravar<K extends keyof Cfg>(chave: K, valor: Cfg[K]) {
    setCfg((c) => (c ? { ...c, [chave]: valor } : c));
    const { error } = await supabase.from("config").upsert({ chave, valor });
    setSalvo(error ? `Erro: ${error.message}` : "Salvo");
    setTimeout(() => setSalvo(""), 2000);
  }

  async function alternarCategoria(c: Categoria) {
    setCategorias((cs) => cs.map((x) => (x.slug === c.slug ? { ...x, ativa: !x.ativa } : x)));
    await supabase.from("categorias").update({ ativa: !c.ativa }).eq("slug", c.slug);
  }

  if (!cfg) return <p className="text-suave">Carregando…</p>;

  return (
    <div>
      <Abas<Aba>
        atual={aba}
        aoTrocar={setAba}
        abas={[
          { id: "automacao", nome: "Automação", icone: "raio" },
          { id: "inteligencia", nome: "Inteligência", icone: "lampada" },
          { id: "categorias", nome: "Categorias", icone: "categorias", contagem: categorias.filter((c) => c.ativa).length },
          { id: "reel", nome: "Reel", icone: "reels" },
          { id: "fontes", nome: "Fontes", icone: "globo" },
          { id: "site", nome: "Site e assinatura", icone: "estrela" },
        ]}
        extra={salvo && <span className="flex items-center gap-1 text-sm text-emerald-500"><Icone nome="check" className="size-4" />{salvo}</span>}
      />

      {aba === "automacao" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="cartao p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">Publicação automática</h3>
                <p className="text-sm text-suave">A cada 10 minutos o sistema pega o assunto com maior nota, acha um vídeo, monta e publica sozinho.</p>
              </div>
              <Chave ligada={cfg.publicacao_automatica} onClick={() => gravar("publicacao_automatica", !cfg.publicacao_automatica)} />
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.publicacao_automatica ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2 text-suave"}`}>
              <span className={`size-1.5 rounded-full ${cfg.publicacao_automatica ? "bg-emerald-500" : "bg-suave"}`} />
              {cfg.publicacao_automatica ? "Piloto automático ligado" : "Modo manual: você aprova cada Reel"}
            </span>
          </section>
          <section className="cartao flex flex-col gap-6 p-6">
            <Faixa rotulo="Nota mínima de viralização" valor={cfg.score_minimo_auto} min={50} max={95} passo={5} aoMudar={(v) => gravar("score_minimo_auto", v)} />
            <Faixa rotulo="Máximo de Reels por dia" valor={cfg.max_posts_dia} min={1} max={30} aoMudar={(v) => gravar("max_posts_dia", v)} />
          </section>
        </div>
      )}

      {aba === "inteligencia" && <Inteligencia apr={cfg.aprendizados ?? {}} atualizar={(a) => setCfg({ ...cfg, aprendizados: a })} />}

      {aba === "categorias" && (
        <section>
          <p className="mb-4 text-sm text-suave">Desligue as que não quer no Radar. Cada categoria tem sua faixa no molde.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {categorias.map((c) => (
              <button
                key={c.slug}
                onClick={() => alternarCategoria(c)}
                className={`cartao flex items-center justify-between gap-3 p-4 text-left transition ${c.ativa ? "" : "opacity-50"}`}
              >
                <span>
                  <b className="block text-sm">{c.label}</b>
                  <span className="text-xs text-suave">{c.nome}</span>
                </span>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${c.ativa ? "border-marca bg-marca text-white" : "border-borda"}`}>
                  {c.ativa && <Icone nome="check" className="size-3" />}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {aba === "reel" && (
        <section className="cartao max-w-3xl p-6">
          <h3 className="mb-1 font-semibold">Rodapé do vídeo</h3>
          <p className="mb-3 text-sm text-suave">Linha vermelha abaixo da manchete em todos os Reels.</p>
          <input
            defaultValue={cfg.rodape ?? ""}
            onBlur={(e) => gravar("rodape", e.target.value.trim())}
            placeholder="Mais notícias em planetadiario.online"
            className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm"
          />
        </section>
      )}

      {aba === "fontes" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ListaEditavel titulo="Países monitorados" ajuda="Códigos separados por vírgula (BR, US, GB…)" valores={cfg.paises} salvar={(v) => gravar("paises", v.map((p) => p.toUpperCase()))} />
          <ListaEditavel titulo="Canais/autores bloqueados" ajuda="Vídeos desses autores nunca são usados" valores={cfg.fontes_bloqueadas} salvar={(v) => gravar("fontes_bloqueadas", v)} />
        </div>
      )}

      {aba === "site" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="cartao p-6">
            <h3 className="mb-1 font-semibold">Preço da assinatura Pro</h3>
            <p className="mb-3 text-sm text-suave">Valor mensal cobrado por PIX (Lytex).</p>
            <div className="flex items-center gap-2">
              <span className="text-suave">R$</span>
              <input
                type="number"
                min={2}
                step={0.1}
                defaultValue={((cfg.assinatura_preco_centavos ?? 990) / 100).toFixed(2)}
                onBlur={(e) => gravar("assinatura_preco_centavos", Math.round(Number(e.target.value) * 100))}
                className="w-32 rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm"
              />
            </div>
          </section>
          <section className="cartao p-6">
            <Faixa
              rotulo="Acesso antecipado dos assinantes (minutos)"
              valor={cfg.acesso_antecipado_min ?? 30}
              min={0}
              max={180}
              passo={5}
              aoMudar={(v) => gravar("acesso_antecipado_min", v)}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function Inteligencia({ apr, atualizar }: { apr: Aprendizados; atualizar: (a: Aprendizados) => void }) {
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState("");

  async function gerar() {
    setRodando(true);
    setMsg("");
    try {
      const r = await api<Aprendizados & { ok: boolean; motivo?: string }>("/aprendizados", { method: "POST" });
      if (r.ok) atualizar(r);
      else setMsg(r.motivo ?? "");
    } catch (e) {
      setMsg((e as Error).message);
    }
    setRodando(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="cartao p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">O que a IA aprendeu</h3>
            <p className="text-sm text-suave">
              Todo dia às 6h a IA compara os Reels que se destacaram com os que foram mal e ajusta manchetes, legendas e a nota das tendências.
            </p>
          </div>
          <button onClick={gerar} disabled={rodando} className="flex items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm hover:bg-painel-2 disabled:opacity-60">
            <Icone nome="recarregar" className={`size-4 ${rodando ? "animate-spin" : ""}`} /> Analisar agora
          </button>
        </div>
        {msg && <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">{msg}</p>}
        {apr.aprendizados?.length ? (
          <ul className="flex flex-col gap-2.5">
            {apr.aprendizados.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-marca/10 text-[11px] font-bold text-marca">{i + 1}</span>
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-suave">Ainda sem aprendizados. Eles aparecem quando houver pelo menos 6 Reels publicados com métricas.</p>
        )}
        {apr.atualizado_em && (
          <p className="mt-4 text-xs text-suave">
            Base: {apr.base} Reels · atualizado em {new Date(apr.atualizado_em).toLocaleString("pt-BR")}
          </p>
        )}
      </section>
      <section className="flex flex-col gap-5">
        <ListaCat titulo="Categorias em alta" itens={apr.categorias_fortes} cor="text-emerald-500" icone="cima" />
        <ListaCat titulo="Categorias em baixa" itens={apr.categorias_fracas} cor="text-red-500" icone="baixo" />
      </section>
    </div>
  );
}

function ListaCat({ titulo, itens, cor, icone }: { titulo: string; itens?: string[]; cor: string; icone: string }) {
  return (
    <div className="cartao p-5">
      <h4 className={`mb-3 flex items-center gap-1.5 text-sm font-semibold ${cor}`}><Icone nome={icone} className="size-4" />{titulo}</h4>
      {itens?.length ? (
        <div className="flex flex-wrap gap-2">{itens.map((c) => <span key={c} className="rounded-md bg-painel-2 px-2 py-1 text-xs font-semibold uppercase">{c}</span>)}</div>
      ) : (
        <p className="text-sm text-suave">—</p>
      )}
    </div>
  );
}

function Chave({ ligada, onClick }: { ligada: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={ligada} className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition ${ligada ? "bg-emerald-500" : "bg-borda"}`}>
      <span className={`block size-6 rounded-full bg-white transition ${ligada ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Faixa({ rotulo, valor, min, max, passo = 1, aoMudar }: { rotulo: string; valor: number; min: number; max: number; passo?: number; aoMudar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-sm"><span>{rotulo}</span><b className="tabular-nums">{valor}</b></span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} className="w-full accent-marca" />
    </label>
  );
}

function ListaEditavel({ titulo, ajuda, valores, salvar }: { titulo: string; ajuda: string; valores: string[]; salvar: (v: string[]) => void }) {
  const [texto, setTexto] = useState(valores.join(", "));
  return (
    <section className="cartao p-6">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mb-3 text-sm text-suave">{ajuda}</p>
      <textarea
        value={texto}
        rows={3}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => salvar(texto.split(",").map((s) => s.trim()).filter(Boolean))}
        className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 text-sm"
      />
    </section>
  );
}
