import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";

interface Cat {
  slug: string;
  label: string;
  nome: string;
  ativa: boolean;
  molde_url: string | null;
  molde_ig_url: string | null;
}

type Rede = "facebook" | "instagram";

// mesmas posições usadas na montagem do vídeo (pipeline/render.py)
const PREVIA: Record<Rede, { degrade: string; topo: string; fonte: string; linhas: string; pasta: string; campo: "molde_url" | "molde_ig_url" }> = {
  facebook: { degrade: "h-[38%]", topo: "top-[78.5%]", fonte: "6.4cqw", linhas: "line-clamp-4", pasta: "moldes", campo: "molde_url" },
  instagram: { degrade: "h-[53%]", topo: "top-[64.8%]", fonte: "5.9cqw", linhas: "line-clamp-3", pasta: "moldes-ig", campo: "molde_ig_url" },
};

export default function Moldes() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [rodape, setRodape] = useState("");
  const [rede, setRede] = useState<Rede>("facebook");
  const [exemplo, setExemplo] = useState("Homem morre após entrar em jaula de tigre em zoológico no Reino Unido neste sábado");

  const carregar = () =>
    supabase.from("categorias").select("slug, label, nome, ativa, molde_url, molde_ig_url").order("ordem").then(({ data }) => setCats(data ?? []));

  useEffect(() => {
    carregar();
    supabase.from("config").select("valor").eq("chave", "rodape").maybeSingle().then(({ data }) => setRodape((data?.valor as string) ?? ""));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="cartao flex flex-col gap-3 p-5 md:flex-row md:items-end">
        <div className="flex rounded-lg border border-borda bg-painel p-0.5 text-sm">
          {(["facebook", "instagram"] as Rede[]).map((r) => (
            <button
              key={r}
              onClick={() => setRede(r)}
              className={`rounded-md px-3 py-1.5 capitalize ${rede === r ? (r === "facebook" ? "bg-fb text-white" : "bg-ig text-white") : "text-suave hover:text-texto"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="flex-1">
          <span className="mb-1 block text-xs text-suave">Texto de exemplo para a prévia</span>
          <input value={exemplo} onChange={(e) => setExemplo(e.target.value)} className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-suave md:max-w-xs">
          {rede === "instagram"
            ? "Instagram: logo, faixa e texto ficam na área segura (o feed recorta o topo e a base)."
            : "Facebook e site: layout original. Envie um PNG transparente 1080×1920 por categoria."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {cats.map((c) => (
          <CartaoMolde key={`${rede}-${c.slug}`} cat={c} rede={rede} exemplo={exemplo} rodape={rodape} atualizado={carregar} />
        ))}
      </div>
    </div>
  );
}

function CartaoMolde({ cat, rede, exemplo, rodape, atualizado }: { cat: Cat; rede: Rede; exemplo: string; rodape: string; atualizado: () => void }) {
  const pv = PREVIA[rede];
  const personalizado = cat[pv.campo];
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const src = personalizado ?? `/${pv.pasta}/${cat.slug}.png`;

  async function enviar(arquivo: File) {
    setErro("");
    if (arquivo.type !== "image/png") return setErro("Use um arquivo PNG");
    const img = await createImageBitmap(arquivo);
    if (Math.abs(img.width / img.height - 9 / 16) > 0.01 || img.width < 1080)
      return setErro(`Tamanho ${img.width}×${img.height}: precisa ser 9:16, mínimo 1080×1920`);
    setEnviando(true);
    const caminho = `${rede}-${cat.slug}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("moldes").upload(caminho, arquivo, { contentType: "image/png" });
    if (error) {
      setErro(error.message);
      setEnviando(false);
      return;
    }
    const url = supabase.storage.from("moldes").getPublicUrl(caminho).data.publicUrl;
    await supabase.from("categorias").update({ [pv.campo]: url }).eq("slug", cat.slug);
    setEnviando(false);
    atualizado();
  }

  async function restaurar() {
    await supabase.from("categorias").update({ [pv.campo]: null }).eq("slug", cat.slug);
    atualizado();
  }

  return (
    <div className={`cartao overflow-hidden ${cat.ativa ? "" : "opacity-60"}`}>
      {/* prévia 9:16 com as mesmas proporções do vídeo final */}
      <div className="relative aspect-[9/16] bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 [container-type:inline-size]">
        <div className={`absolute inset-x-0 bottom-0 ${pv.degrade} bg-gradient-to-b from-transparent via-black/70 to-black/90`} />
        <img src={src} alt={`Molde ${cat.label}`} className="absolute inset-0 h-full w-full" />
        <div className={`absolute inset-x-[6.5%] ${pv.topo} text-center`}>
          <p className={`${pv.linhas} font-bold leading-[1.18] text-white`} style={{ fontSize: pv.fonte, fontFamily: "Montserrat, Inter, sans-serif" }}>
            {exemplo}
          </p>
          {rodape && <p className="mt-[1.5cqw] font-semibold text-[#ff2828]" style={{ fontSize: "3.1cqw" }}>{rodape}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <b className="text-sm">{cat.label}</b>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${personalizado ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-painel-2 text-suave"}`}>
            {personalizado ? "Personalizado" : "Padrão"}
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
        {personalizado && (
          <button onClick={restaurar} className="text-xs text-suave hover:text-texto">
            Voltar ao padrão
          </button>
        )}
        {erro && <p className="text-xs text-red-500">{erro}</p>}
      </div>
    </div>
  );
}
