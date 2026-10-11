import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api, type Categoria } from "../api";

export default function NovoReel({ criado }: { criado: () => void }) {
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState("noticias");
  const [auto, setAuto] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.from("categorias").select("*").eq("ativa", true).order("ordem").then(({ data }) => setCategorias(data ?? []));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await api("/reels", { method: "POST", body: JSON.stringify({ origem_url: url.trim(), categoria, auto_publicar: auto }) });
      criado();
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="text-base font-semibold">Novo Reel a partir de um link</h2>
      <p className="mb-5 text-sm text-suave">
        Cole o link de um vídeo (YouTube, TikTok, Instagram, X/Twitter, Kwai, Facebook, Dailymotion…). O sistema baixa,
        aplica o molde, escreve a manchete, a legenda e as hashtags.
      </p>
      <form onSubmit={enviar} className="flex flex-col gap-4 cartao p-5">
        <div>
          <label className="mb-1 block text-sm text-suave">Link do vídeo</label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-suave">Categoria (texto da faixa vermelha)</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                type="button"
                key={c.slug}
                onClick={() => setCategoria(c.slug)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${categoria === c.slug ? "bg-marca text-white" : "border border-borda text-suave"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-marca" />
          Publicar no Facebook assim que ficar pronto (sem revisão)
        </label>
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        <button disabled={enviando} className="rounded-lg bg-marca py-2.5 font-semibold text-white disabled:opacity-60">
          {enviando ? "Enviando…" : "Gerar Reel"}
        </button>
      </form>
    </div>
  );
}
