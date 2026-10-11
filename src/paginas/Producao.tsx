import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api, tempoAtras, type Reel } from "../api";

const STATUS: Record<Reel["status"], { nome: string; cor: string }> = {
  na_fila: { nome: "Na fila", cor: "bg-slate-600" },
  processando: { nome: "Montando vídeo…", cor: "bg-globo" },
  pronto: { nome: "Pronto p/ publicar", cor: "bg-green-600" },
  publicando: { nome: "Publicando…", cor: "bg-globo" },
  publicado: { nome: "Publicado", cor: "bg-emerald-700" },
  erro: { nome: "Erro", cor: "bg-red-600" },
  rejeitado: { nome: "Rejeitado", cor: "bg-slate-700" },
};

const FILTROS = {
  ativos: ["na_fila", "processando", "pronto", "publicando", "erro"],
  publicados: ["publicado"],
  rejeitados: ["rejeitado"],
} as const;

export default function Producao() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [filtro, setFiltro] = useState<keyof typeof FILTROS>("ativos");

  useEffect(() => {
    let ativo = true;
    const carregar = () =>
      supabase
        .from("reels")
        .select("*")
        .in("status", [...FILTROS[filtro]])
        .order("criado_em", { ascending: false })
        .limit(60)
        .then(({ data }) => ativo && setReels((data as Reel[]) ?? []));
    carregar();
    const canal = supabase
      .channel("reels")
      .on("postgres_changes", { event: "*", schema: "public", table: "reels" }, carregar)
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [filtro]);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold">Produção</h1>
        <p className="text-sm text-suave">Revise, ajuste a legenda e publique. Atualiza sozinho.</p>
      </header>
      <div className="mb-5 flex gap-2 text-sm">
        {(Object.keys(FILTROS) as (keyof typeof FILTROS)[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-3 py-1 capitalize ${filtro === f ? "border-marca bg-marca/15" : "border-borda text-suave"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {reels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borda p-8 text-center text-suave">Nenhum Reel aqui.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reels.map((r) => <CartaoReel key={r.id} reel={r} />)}
        </div>
      )}
    </div>
  );
}

function CartaoReel({ reel }: { reel: Reel }) {
  const [legenda, setLegenda] = useState(reel.legenda ?? "");
  const [tags, setTags] = useState(reel.hashtags.join(" "));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  const st = STATUS[reel.status];
  const editado = legenda !== (reel.legenda ?? "") || tags !== reel.hashtags.join(" ");

  useEffect(() => {
    setLegenda(reel.legenda ?? "");
    setTags(reel.hashtags.join(" "));
  }, [reel.legenda, reel.hashtags]);

  async function acao(fn: () => PromiseLike<unknown>) {
    setOcupado(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setOcupado(false);
  }

  const salvar = () =>
    supabase
      .from("reels")
      .update({
        legenda,
        hashtags: tags.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean),
      })
      .eq("id", reel.id)
      .then(({ error }) => {
        if (error) throw error;
      });

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-borda bg-painel">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] bg-black">
        {reel.video_url ? (
          <video src={reel.video_url} poster={reel.thumb_url ?? undefined} controls playsInline preload="none" className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-suave">
            {reel.status === "erro" ? "Falhou ao montar" : "Montando o vídeo com o seu molde…"}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded px-1.5 py-0.5 font-semibold text-white ${st.cor}`}>{st.nome}</span>
          <span className="rounded bg-marca px-1.5 py-0.5 font-bold uppercase text-white">{reel.categoria}</span>
          <span className="ml-auto text-suave">{tempoAtras(reel.criado_em)}</span>
        </div>
        {reel.manchete && <p className="font-bold">{reel.manchete}</p>}
        <a href={reel.origem_url} target="_blank" rel="noreferrer" className="truncate text-xs text-globo">
          Fonte: {reel.origem_autor ?? reel.origem_url}
        </a>
        {reel.erro && <p className="rounded bg-red-500/15 p-2 text-xs text-red-300">{reel.erro}</p>}

        {reel.status !== "na_fila" && reel.status !== "processando" && (
          <>
            <label className="text-xs text-suave">Legenda</label>
            <textarea
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              rows={5}
              className="rounded-lg border border-borda bg-fundo p-2 text-sm"
            />
            <label className="text-xs text-suave">Hashtags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="rounded-lg border border-borda bg-fundo p-2 text-sm" />
          </>
        )}

        {msg && <p className="text-xs text-red-400">{msg}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {reel.status === "publicado" && reel.fb_post_url && (
            <a href={reel.fb_post_url} target="_blank" rel="noreferrer" className="rounded-lg bg-globo px-3 py-1.5 font-semibold">
              Ver no Facebook
            </a>
          )}
          {reel.status === "pronto" && (
            <button
              disabled={ocupado}
              onClick={() => acao(async () => { if (editado) await salvar(); await api(`/reels/${reel.id}/publicar`, { method: "POST" }); })}
              className="rounded-lg bg-marca px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            >
              {ocupado ? "…" : "Publicar agora"}
            </button>
          )}
          {editado && (
            <button disabled={ocupado} onClick={() => acao(salvar)} className="rounded-lg border border-borda px-3 py-1.5">
              Salvar texto
            </button>
          )}
          {["pronto", "erro", "rejeitado"].includes(reel.status) && (
            <button disabled={ocupado} onClick={() => acao(() => api(`/reels/${reel.id}/renderizar`, { method: "POST" }))} className="rounded-lg border border-borda px-3 py-1.5">
              Refazer
            </button>
          )}
          {["pronto", "erro", "na_fila"].includes(reel.status) && (
            <button
              disabled={ocupado}
              onClick={() => acao(() => supabase.from("reels").update({ status: "rejeitado" }).eq("id", reel.id).then())}
              className="rounded-lg px-3 py-1.5 text-suave hover:text-white"
            >
              Rejeitar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
