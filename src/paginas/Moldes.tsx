import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";

interface Cat {
  slug: string;
  label: string;
  nome: string;
  ativa: boolean;
  molde_url: string | null;
}

export default function Moldes() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [rodape, setRodape] = useState("");
  const [exemplo, setExemplo] = useState("Homem morre após entrar em jaula de tigre em zoológico no Reino Unido neste sábado");

  const carregar = () =>
    supabase.from("categorias").select("slug, label, nome, ativa, molde_url").order("ordem").then(({ data }) => setCats(data ?? []));

  useEffect(() => {
    carregar();
    supabase.from("config").select("valor").eq("chave", "rodape").maybeSingle().then(({ data }) => setRodape((data?.valor as string) ?? ""));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="cartao flex flex-col gap-3 p-5 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-suave">Texto de exemplo para a prévia</span>
          <input value={exemplo} onChange={(e) => setExemplo(e.target.value)} className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-suave md:max-w-xs">
          Envie um PNG transparente 1080×1920 (ou 1152×2048) por categoria. A manchete é escrita abaixo da faixa; o vídeo fica por trás.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {cats.map((c) => (
          <CartaoMolde key={c.slug} cat={c} exemplo={exemplo} rodape={rodape} atualizado={carregar} />
        ))}
      </div>
    </div>
  );
}

function CartaoMolde({ cat, exemplo, rodape, atualizado }: { cat: Cat; exemplo: string; rodape: string; atualizado: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const src = cat.molde_url ?? `/moldes/${cat.slug}.png`;

  async function enviar(arquivo: File) {
    setErro("");
    if (arquivo.type !== "image/png") return setErro("Use um arquivo PNG");
    const img = await createImageBitmap(arquivo);
    if (Math.abs(img.width / img.height - 9 / 16) > 0.01 || img.width < 1080)
      return setErro(`Tamanho ${img.width}×${img.height}: precisa ser 9:16, mínimo 1080×1920`);
    setEnviando(true);
    const caminho = `${cat.slug}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("moldes").upload(caminho, arquivo, { contentType: "image/png" });
    if (error) {
      setErro(error.message);
      setEnviando(false);
      return;
    }
    const url = supabase.storage.from("moldes").getPublicUrl(caminho).data.publicUrl;
    await supabase.from("categorias").update({ molde_url: url }).eq("slug", cat.slug);
    setEnviando(false);
    atualizado();
  }

  async function restaurar() {
    await supabase.from("categorias").update({ molde_url: null }).eq("slug", cat.slug);
    atualizado();
  }

  return (
    <div className={`cartao overflow-hidden ${cat.ativa ? "" : "opacity-60"}`}>
      {/* prévia 9:16 com as mesmas proporções do vídeo final */}
      <div className="relative aspect-[9/16] bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 [container-type:inline-size]">
        <div className="absolute inset-x-0 bottom-0 h-[53%] bg-gradient-to-b from-transparent via-black/70 to-black/90" />
        <img src={src} alt={`Molde ${cat.label}`} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-[6.5%] top-[64.8%] text-center">
          <p className="line-clamp-3 font-bold leading-[1.18] text-white" style={{ fontSize: "5.9cqw", fontFamily: "Montserrat, Inter, sans-serif" }}>
            {exemplo}
          </p>
          {rodape && <p className="mt-[1.5cqw] font-semibold text-[#ff2828]" style={{ fontSize: "3.1cqw" }}>{rodape}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <b className="text-sm">{cat.label}</b>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cat.molde_url ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-painel-2 text-suave"}`}>
            {cat.molde_url ? "Personalizado" : "Padrão"}
          </span>
        </div>
        <input ref={input} type="file" accept="image/png" hidden onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
        <button
          onClick={() => input.current?.click()}
          disabled={enviando}
          className="flex items-center justify-center gap-2 rounded-lg border border-borda py-1.5 text-sm hover:bg-painel-2 disabled:opacity-60"
        >
          <Icone nome="upload" className="size-4" /> {enviando ? "Enviando…" : "Trocar molde"}
        </button>
        {cat.molde_url && (
          <button onClick={restaurar} className="text-xs text-suave hover:text-texto">
            Voltar ao padrão
          </button>
        )}
        {erro && <p className="text-xs text-red-500">{erro}</p>}
      </div>
    </div>
  );
}
