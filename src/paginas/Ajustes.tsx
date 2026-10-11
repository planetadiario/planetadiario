import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Categoria } from "../api";

interface Cfg {
  publicacao_automatica: boolean;
  score_minimo_auto: number;
  max_posts_dia: number;
  paises: string[];
  fontes_bloqueadas: string[];
}

export default function Ajustes() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [salvo, setSalvo] = useState("");

  useEffect(() => {
    supabase.from("config").select("*").then(({ data }) =>
      setCfg(Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor])) as Cfg),
    );
    supabase.from("categorias").select("*").order("ordem").then(({ data }) => setCategorias(data ?? []));
  }, []);

  async function gravar<K extends keyof Cfg>(chave: K, valor: Cfg[K]) {
    setCfg((c) => (c ? { ...c, [chave]: valor } : c));
    const { error } = await supabase.from("config").upsert({ chave, valor });
    setSalvo(error ? `Erro: ${error.message}` : "Salvo ✓");
    setTimeout(() => setSalvo(""), 2000);
  }

  async function alternarCategoria(c: Categoria) {
    setCategorias((cs) => cs.map((x) => (x.slug === c.slug ? { ...x, ativa: !x.ativa } : x)));
    await supabase.from("categorias").update({ ativa: !c.ativa }).eq("slug", c.slug);
  }

  if (!cfg) return <p className="text-suave">Carregando…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Ajustes</h1>
        <span className="text-sm text-green-400">{salvo}</span>
      </header>

      <section className="mb-5 rounded-2xl border border-borda bg-painel p-5">
        <h2 className="mb-1 font-semibold">Piloto automático</h2>
        <p className="mb-4 text-sm text-suave">
          Quando ligado, a cada 10 minutos o sistema pega o assunto com maior pontuação, encontra um vídeo, monta o Reel e
          publica sozinho.
        </p>
        <label className="mb-4 flex items-center justify-between gap-3">
          <span>Publicação automática</span>
          <button
            onClick={() => gravar("publicacao_automatica", !cfg.publicacao_automatica)}
            className={`h-7 w-12 rounded-full p-0.5 transition ${cfg.publicacao_automatica ? "bg-green-500" : "bg-borda"}`}
          >
            <span className={`block size-6 rounded-full bg-white transition ${cfg.publicacao_automatica ? "translate-x-5" : ""}`} />
          </button>
        </label>
        <label className="mb-4 block">
          <span className="flex justify-between text-sm"><span>Pontuação mínima (🔥)</span><b>{cfg.score_minimo_auto}</b></span>
          <input
            type="range" min={50} max={95} step={5} value={cfg.score_minimo_auto}
            onChange={(e) => gravar("score_minimo_auto", Number(e.target.value))}
            className="w-full accent-marca"
          />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm"><span>Máximo de Reels por dia</span><b>{cfg.max_posts_dia}</b></span>
          <input
            type="range" min={1} max={30} value={cfg.max_posts_dia}
            onChange={(e) => gravar("max_posts_dia", Number(e.target.value))}
            className="w-full accent-marca"
          />
        </label>
      </section>

      <section className="mb-5 rounded-2xl border border-borda bg-painel p-5">
        <h2 className="mb-1 font-semibold">Categorias</h2>
        <p className="mb-3 text-sm text-suave">Desligue as que não quer no radar. Cada uma tem sua faixa no molde.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categorias.map((c) => (
            <button
              key={c.slug}
              onClick={() => alternarCategoria(c)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${c.ativa ? "border-marca/60" : "border-borda opacity-50"}`}
            >
              <b className="block text-xs">{c.label}</b>
              <span className="text-xs text-suave">{c.nome}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-borda bg-painel p-5">
        <h2 className="mb-3 font-semibold">Fontes</h2>
        <ListaEditavel
          titulo="Países monitorados (códigos)"
          valores={cfg.paises}
          salvar={(v) => gravar("paises", v.map((p) => p.toUpperCase()))}
        />
        <ListaEditavel
          titulo="Canais/autores bloqueados (não usar vídeos deles)"
          valores={cfg.fontes_bloqueadas}
          salvar={(v) => gravar("fontes_bloqueadas", v)}
        />
      </section>
    </div>
  );
}

function ListaEditavel({ titulo, valores, salvar }: { titulo: string; valores: string[]; salvar: (v: string[]) => void }) {
  const [texto, setTexto] = useState(valores.join(", "));
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm text-suave">{titulo}</span>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => salvar(texto.split(",").map((s) => s.trim()).filter(Boolean))}
        className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm"
      />
    </label>
  );
}
