import { useEffect, useRef, useState } from "react";
import Icone from "../Icone";
import QRCode from "qrcode";
import { supabase } from "../supabase";
import { aoClicar, apiSite, entrarComGoogle, type Leitor } from "./base";
import { LogoGoogle } from "./Site";

const BENEFICIOS = [
  ["raio", "Notícias antes", "Veja as notícias antes de saírem no Facebook e no Instagram."],
  ["cadeado", "Conteúdo exclusivo", "Vídeos e matérias só para assinantes."],
  ["proibido", "Sem anúncios", "Leia e assista sem nenhuma propaganda."],
  ["trofeu", "Selo Pro e pontos", "Selo nos comentários, +100 pontos na assinatura e pontos em dobro."],
];

export default function Assinar({ leitor }: { leitor: Leitor | null | undefined }) {
  const [preco, setPreco] = useState<number | null>(null);
  const [cpf, setCpf] = useState("");
  const [tel, setTel] = useState("");
  const [pix, setPix] = useState<{ fatura: string; codigo: string; qr: string } | null>(null);
  const [status, setStatus] = useState<"" | "gerando" | "aguardando" | "ativa">("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    supabase.rpc("preco_assinatura").then(({ data }) => setPreco(Number(data ?? 990)));
    return () => window.clearInterval(timer.current);
  }, []);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setStatus("gerando");
    try {
      const r = await apiSite<{ fatura: string; pix: string }>("/assinar", {
        method: "POST",
        body: JSON.stringify({ cpf, telefone: tel }),
      });
      setPix({ fatura: r.fatura, codigo: r.pix, qr: await QRCode.toDataURL(r.pix, { width: 280, margin: 1 }) });
      setStatus("aguardando");
      timer.current = window.setInterval(async () => {
        const s = await apiSite<{ status: string }>(`/assinatura/${r.fatura}`).catch(() => null);
        if (s?.status === "ativa") {
          window.clearInterval(timer.current);
          setStatus("ativa");
          setTimeout(() => window.location.assign("/conta"), 2500);
        }
      }, 5000);
    } catch (e) {
      setErro((e as Error).message);
      setStatus("");
    }
  }

  const valor = preco != null ? (preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "…";

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-marca">Planeta Diário Pro</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">Esteja sempre um passo à frente</h1>
        <p className="mt-2 text-suave">
          <b className="text-2xl text-texto">{valor}</b> / mês · pagamento por PIX, sem fidelidade
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {BENEFICIOS.map(([i, t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca/10 text-marca"><Icone nome={i} /></span>
              <span>
                <b className="block">{t}</b>
                <span className="text-sm text-suave">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="cartao p-6">
        {leitor === undefined ? null : !leitor ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="font-semibold">Entre para assinar</p>
            <button onClick={() => entrarComGoogle()} className="flex items-center gap-2 rounded-full border border-borda bg-painel px-5 py-2.5 font-medium hover:bg-painel-2">
              <LogoGoogle /> Entrar com o Google
            </button>
          </div>
        ) : status === "ativa" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"><Icone nome="checkCirculo" className="size-8" /></span>
            <p className="text-xl font-bold">Assinatura ativa!</p>
            <p className="text-sm text-suave">Você ganhou 100 pontos. Redirecionando…</p>
          </div>
        ) : pix ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="font-semibold">Pague {valor} com PIX</p>
            <img src={pix.qr} alt="QR Code PIX" className="size-56 rounded-lg bg-white p-2" />
            <button
              onClick={() => navigator.clipboard.writeText(pix.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); })}
              className="w-full rounded-full bg-marca py-2.5 font-semibold text-white"
            >
              {copiado ? "Código copiado" : "Copiar PIX copia e cola"}
            </button>
            <p className="flex items-center gap-2 text-sm text-suave">
              <span className="size-2 animate-pulse rounded-full bg-amber-500" /> Aguardando o pagamento… a confirmação é automática.
            </p>
          </div>
        ) : leitor.assinante ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="flex items-center gap-2 text-lg font-bold"><Icone nome="estrela" className="size-5 text-amber-400" /> Você já é assinante</p>
            <p className="text-sm text-suave">Válida até {new Date(leitor.fimAssinatura!).toLocaleDateString("pt-BR")}. Pague de novo para somar mais 30 dias.</p>
            <FormPix cpf={cpf} setCpf={setCpf} tel={tel} setTel={setTel} gerar={gerar} status={status} erro={erro} rotulo="Renovar por mais 30 dias" />
          </div>
        ) : (
          <FormPix cpf={cpf} setCpf={setCpf} tel={tel} setTel={setTel} gerar={gerar} status={status} erro={erro} rotulo={`Assinar por ${valor}`} />
        )}
      </div>
      <p className="text-xs text-suave md:col-span-2">
        A assinatura dura 30 dias a partir do pagamento e não renova sozinha: avisamos quando estiver perto de acabar.{" "}
        <a href="/" onClick={aoClicar("/")} className="underline">Voltar às notícias</a>
      </p>
    </div>
  );
}

function FormPix(p: {
  cpf: string; setCpf: (v: string) => void; tel: string; setTel: (v: string) => void;
  gerar: (e: React.FormEvent) => void; status: string; erro: string; rotulo: string;
}) {
  return (
    <form onSubmit={p.gerar} className="mt-2 flex w-full flex-col gap-3 text-left">
      <label className="text-sm">
        <span className="mb-1 block text-suave">CPF (exigido pelo PIX)</span>
        <input required inputMode="numeric" value={p.cpf} onChange={(e) => p.setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-suave">Celular (opcional)</span>
        <input inputMode="tel" value={p.tel} onChange={(e) => p.setTel(e.target.value)} placeholder="(11) 90000-0000" className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5" />
      </label>
      {p.erro && <p className="text-sm text-red-500">{p.erro}</p>}
      <button disabled={p.status === "gerando"} className="rounded-full bg-marca py-2.5 font-semibold text-white disabled:opacity-60">
        {p.status === "gerando" ? "Gerando PIX…" : p.rotulo}
      </button>
    </form>
  );
}
