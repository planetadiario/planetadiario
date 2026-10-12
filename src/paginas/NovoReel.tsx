import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api, type Categoria } from "../api";
import Icone from "../Icone";

const PASSOS = [
  ["baixar", "Baixa o vídeo", "YouTube, TikTok, Instagram, X/Twitter, Kwai, Facebook, Dailymotion e outros."],
  ["lampada", "IA escreve", "Manchete, legenda com pergunta, artigo para o site e hashtags. Confirma a categoria pelo assunto."],
  ["moldes", "Aplica o molde", "Duas versões: layout original no Facebook/site e área segura no Instagram."],
  ["enviar", "Você revisa e publica", "Aparece em Produção; publica no Facebook, Instagram e site de uma vez."],
];

export default function NovoReel({ criado }: { criado: () => void }) {
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState(""); // "" = a IA decide
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
      await api("/reels", {
        method: "POST",
        body: JSON.stringify({ origem_url: url.trim(), categoria: categoria || undefined, auto_publicar: auto }),
      });
      criado();
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  const chip = (valor: string, rotulo: string) => (
    <button
      type="button"
      key={valor || "auto"}
      onClick={() => setCategoria(valor)}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${categoria === valor ? "bg-marca text-white" : "border border-borda text-suave hover:text-texto"}`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={enviar} className="cartao flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Novo Reel a partir de um link</h2>
          <p className="text-sm text-suave">Cole o link do vídeo e o sistema faz o resto.</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Link do vídeo</span>
          <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 focus-within:border-globo">
            <Icone nome="link" className="size-4 text-suave" />
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full bg-transparent py-3 outline-none" />
          </div>
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Categoria (faixa vermelha do molde)</span>
          <div className="flex flex-wrap gap-2">
            {chip("", "AUTOMÁTICA (IA DECIDE)")}
            {categorias.map((c) => chip(c.slug, c.label))}
          </div>
          <p className="mt-2 text-xs text-suave">
            {categoria ? "Categoria fixa: a IA não altera." : "A IA escolhe a categoria pelo assunto do vídeo (ex.: espaço vira CIÊNCIA)."}
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-borda p-3 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-marca" />
          <span>
            <b className="block">Publicar assim que ficar pronto</b>
            <span className="text-suave">Vai direto para Facebook, Instagram e site, sem revisão.</span>
          </span>
        </label>
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <button disabled={enviando} className="flex items-center justify-center gap-2 rounded-lg bg-marca py-3 font-semibold text-white disabled:opacity-60">
          <Icone nome="reels" className="size-5" /> {enviando ? "Enviando…" : "Gerar Reel"}
        </button>
      </form>

      <aside className="cartao p-6">
        <h3 className="mb-4 font-semibold">Como funciona</h3>
        <ol className="flex flex-col gap-5">
          {PASSOS.map(([icone, titulo, texto], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca/10 text-marca"><Icone nome={icone} className="size-4" /></span>
              <span>
                <b className="block text-sm">{i + 1}. {titulo}</b>
                <span className="text-sm text-suave">{texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
