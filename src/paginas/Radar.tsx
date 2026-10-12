import { useCallback, useEffect, useState } from "react";
import Icone from "../Icone";
import { supabase } from "../supabase";
import {
  api, FONTE, numeroCurto, tempoAtras,
  type Categoria, type Tendencia, type VideoEncontrado,
} from "../api";

const JANELAS = { "2h": 2, "6h": 6, "24h": 24, "3d": 72 } as const;

export default function Radar({ irParaProducao }: { irParaProducao: () => void }) {
  const [itens, setItens] = useState<Tendencia[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cat, setCat] = useState("");
  const [tipo, setTipo] = useState<"" | "videos" | "assuntos">("");
  const [janela, setJanela] = useState<keyof typeof JANELAS>("6h");
  const [soBrasil, setSoBrasil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [coletando, setColetando] = useState(false);
  const [busca, setBusca] = useState<Tendencia | null>(null);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const desde = new Date(Date.now() - JANELAS[janela] * 3600_000).toISOString();
    let q = supabase
      .from("tendencias")
      .select("*")
      .gte("detectado_em", desde)
      .order("score", { ascending: false })
      .order("detectado_em", { ascending: false })
      .limit(120);
    if (cat) q = q.eq("categoria", cat);
    if (tipo === "videos") q = q.not("video_url", "is", null);
    if (tipo === "assuntos") q = q.is("video_url", null);
    if (soBrasil) q = q.eq("pais", "BR");
    const { data } = await q;
    setItens((data as Tendencia[]) ?? []);
    setCarregando(false);
  }, [cat, tipo, janela, soBrasil]);

  useEffect(() => {
    supabase.from("categorias").select("*").order("ordem").then(({ data }) => setCategorias(data ?? []));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function coletarAgora() {
    setColetando(true);
    try {
      await api("/coletar", { method: "POST" });
      await carregar();
    } catch (e) {
      setAviso((e as Error).message);
    }
    setColetando(false);
  }

  async function gerar(t: Tendencia, videoUrl: string, autor?: string) {
    try {
      await api("/reels", {
        method: "POST",
        body: JSON.stringify({
          origem_url: videoUrl,
          categoria: t.categoria ?? "noticias",
          tendencia_id: t.id,
          origem_titulo: t.titulo,
          origem_autor: autor ?? t.extra?.autor,
        }),
      });
      setBusca(null);
      irParaProducao();
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  const nomeCat = (s: string | null) => categorias.find((c) => c.slug === s)?.label ?? "—";

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Radar de tendências</h2>
          <p className="text-sm text-suave">O que está bombando agora no mundo, pontuado pela IA</p>
        </div>
        <button
          onClick={coletarAgora}
          disabled={coletando}
          className="flex items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm hover:border-globo disabled:opacity-60"
        >
          <Icone nome="recarregar" className={`size-4 ${coletando ? "animate-spin" : ""}`} /> {coletando ? "Coletando…" : "Coletar agora"}
        </button>
      </header>

      {aviso && (
        <p onClick={() => setAviso("")} className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
          {aviso}
        </p>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 text-sm [scrollbar-width:none]">
        <Filtro ativo={!cat} onClick={() => setCat("")}>Todas</Filtro>
        {categorias.filter((c) => c.ativa).map((c) => (
          <Filtro key={c.slug} ativo={cat === c.slug} onClick={() => setCat(c.slug)}>
            {c.label}
          </Filtro>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {(["", "videos", "assuntos"] as const).map((t) => (
          <Filtro key={t} ativo={tipo === t} onClick={() => setTipo(t)}>
            <span className="flex items-center gap-1.5">{t === "videos" && <Icone nome="video" className="size-3.5" />}{t === "assuntos" && <Icone nome="busca" className="size-3.5" />}{t === "" ? "Tudo" : t === "videos" ? "Vídeos" : "Assuntos"}</span>
          </Filtro>
        ))}
        <span className="mx-1 w-px bg-borda" />
        {(Object.keys(JANELAS) as (keyof typeof JANELAS)[]).map((j) => (
          <Filtro key={j} ativo={janela === j} onClick={() => setJanela(j)}>{j}</Filtro>
        ))}
        <span className="mx-1 w-px bg-borda" />
        <Filtro ativo={soBrasil} onClick={() => setSoBrasil(!soBrasil)}>Só Brasil</Filtro>
      </div>

      {carregando ? (
        <p className="text-suave">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borda p-8 text-center text-suave">
          Nada por aqui ainda. Clique em “Coletar agora” ou aguarde a próxima coleta automática (a cada 10 min).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {itens.map((t) => (
            <article key={t.id} className="flex flex-col overflow-hidden cartao">
              {t.imagem && (
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img src={t.imagem} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  {t.extra?.duracao != null && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 text-xs">
                      {Math.floor(t.extra.duracao / 60)}:{String(t.extra.duracao % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-suave">
                  <Score valor={t.analisado ? t.score : null} />
                  <span className="rounded bg-marca px-1.5 py-0.5 font-bold text-white">{nomeCat(t.categoria)}</span>
                  <span className="flex items-center gap-1 rounded bg-painel-2 px-1.5 py-0.5 font-semibold"><Icone nome="globo" className="size-3" />{t.pais ?? "—"}</span>
                  <span>{FONTE[t.fonte] ?? t.fonte}</span>
                  <span className="ml-auto">{tempoAtras(t.detectado_em)}</span>
                </div>
                <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{t.titulo_pt ?? t.titulo}</h2>
                {t.titulo_pt && t.titulo_pt !== t.titulo && <p className="line-clamp-1 text-[11px] text-suave">{t.titulo}</p>}
                {t.resumo && <p className="line-clamp-2 text-xs text-suave">{t.resumo}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-sm">
                  {t.trafego != null && (
                    <span className="text-xs text-suave">
                      {numeroCurto(t.trafego)} {t.fonte === "google_trends" ? "buscas" : t.fonte === "dailymotion" ? "views/h" : "views"}
                    </span>
                  )}
                  {t.usado && <span className="text-xs text-amber-400">já usado</span>}
                  <div className="ml-auto flex gap-2">
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noreferrer" className="rounded-lg border border-borda px-2.5 py-1.5 hover:border-globo">
                        Abrir
                      </a>
                    )}
                    {t.video_url ? (
                      <button onClick={() => gerar(t, t.video_url!)} className="rounded-lg bg-marca px-2.5 py-1.5 font-semibold text-white">
                        Gerar Reel
                      </button>
                    ) : (
                      <button onClick={() => setBusca(t)} className="rounded-lg bg-globo px-2.5 py-1.5 font-semibold text-white">
                        Buscar vídeos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {busca && <BuscaVideos tendencia={busca} fechar={() => setBusca(null)} escolher={(v) => gerar(busca, v.video_url, v.extra.autor)} />}
    </div>
  );
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 ${ativo ? "border-marca bg-marca/10 text-marca font-medium" : "border-borda text-suave hover:text-texto"}`}
    >
      {children}
    </button>
  );
}

function Score({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="rounded bg-borda px-1.5 py-0.5">IA…</span>;
  const cor = valor >= 80 ? "bg-green-500" : valor >= 60 ? "bg-amber-500" : "bg-slate-600";
  return <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-bold text-white ${cor}`}><Icone nome="fogo" className="size-3" />{valor}</span>;
}

function BuscaVideos({
  tendencia, fechar, escolher,
}: { tendencia: Tendencia; fechar: () => void; escolher: (v: VideoEncontrado) => void }) {
  const [q, setQ] = useState(tendencia.extra?.busca ?? tendencia.titulo);
  const [videos, setVideos] = useState<VideoEncontrado[] | null>(null);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async (termo: string) => {
    setVideos(null);
    setErro("");
    try {
      const r = await api<{ videos: VideoEncontrado[] }>(`/buscar-videos?q=${encodeURIComponent(termo)}`);
      setVideos(r.videos);
    } catch (e) {
      setErro((e as Error).message);
      setVideos([]);
    }
  }, []);

  useEffect(() => {
    buscar(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 sm:items-center" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-borda bg-painel p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Vídeos sobre: {tendencia.titulo_pt ?? tendencia.titulo}</h3>
          <button onClick={fechar} aria-label="Fechar" className="text-suave hover:text-texto"><Icone nome="fechar" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); buscar(q); }} className="mb-3 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 rounded-lg border border-borda bg-fundo px-3 py-2 text-sm" />
          <button className="rounded-lg bg-globo px-3 text-sm font-semibold">Buscar</button>
        </form>
        {erro && <p className="mb-2 text-sm text-red-400">{erro}</p>}
        {videos === null ? (
          <p className="text-sm text-suave">Buscando…</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-suave">Nenhum vídeo curto recente encontrado. Tente outro termo ou cole um link na aba “Novo Reel”.</p>
        ) : (
          <ul className="grid gap-2">
            {videos.map((v) => (
              <li key={v.video_url} className="flex gap-3 rounded-lg border border-borda p-2">
                {v.imagem && <img src={v.imagem} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{v.titulo}</p>
                  <p className="text-xs text-suave">
                    {FONTE[v.fonte]} · {v.extra.autor} {v.extra.publicado && `· ${tempoAtras(v.extra.publicado)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <a href={v.url} target="_blank" rel="noreferrer" className="rounded border border-borda px-2 py-1 text-center text-xs">Ver</a>
                  <button onClick={() => escolher(v)} className="rounded bg-marca px-2 py-1 text-xs font-semibold">Usar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
