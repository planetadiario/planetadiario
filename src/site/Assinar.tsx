import { useEffect, useRef, useState } from "react";
import Icone from "../Icone";
import QRCode from "qrcode";
import { supabase } from "../supabase";
import { aoClicar, apiSite, entrarComGoogle, type Leitor } from "./base";
import { LogoGoogle } from "./Site";
import IconeRede from "../IconeRede";
import { SigaRedes } from "./Redes";

const BENEFICIOS = [
  ["raio", "Notícias 30 minutos antes", "Cada notícia chega primeiro para você, antes de ir para o Facebook, o Instagram e o resto do site."],
  ["enviar", "Alertas no Telegram", "Receba as notícias em primeira mão direto no seu Telegram, pelo nosso bot."],
  ["proibido", "Site sem anúncios", "Leia e assista sem nenhuma propaganda."],
  ["cadeado", "Conteúdo exclusivo", "Vídeos e matérias só para assinantes."],
  ["trofeu", "Selo Pro e pontos em dobro", "Selo nos comentários, +100 pontos na assinatura e o dobro de pontos no ranking."],
  ["coracao", "Apoie o jornalismo independente", "Sua assinatura mantém o Planeta Diário no ar, publicando o dia inteiro."],
];

const COMPARACAO: [string, boolean, boolean][] = [
  ["Notícias e vídeos do dia", true, true],
  ["Comentar e ganhar pontos", true, true],
  ["Notícias 30 minutos antes", false, true],
  ["Alertas no Telegram", false, true],
  ["Site sem anúncios", false, true],
  ["Conteúdo exclusivo", false, true],
  ["Selo Pro e pontos em dobro", false, true],
];

const PERGUNTAS = [
  ["Renova sozinho?", "Não. A assinatura vale 30 dias a partir do pagamento e não há cobrança automática. Avisamos no site quando estiver perto de acabar; para continuar, é só pagar outro PIX."],
  ["Como funciona o acesso antecipado?", "Toda notícia publicada fica 30 minutos visível só para assinantes Pro, no site e no bot do Telegram. Depois ela é liberada para todos e vai para as redes sociais."],
  ["Posso cancelar?", "Não existe fidelidade: se não quiser continuar, basta não renovar. Você pode pedir reembolso em até 7 dias após o pagamento."],
  ["Por que pedem o CPF?", "O PIX é emitido pela nossa processadora de pagamentos (Lytex), que exige o CPF do pagador. Não usamos o CPF para mais nada."],
  ["Já paguei pelo Telegram. E agora?", "O bot te enviou um código. Entre em Minha conta, na aba Assinatura, e digite o código para ativar o Pro também no site."],
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
    <div className="mx-auto max-w-5xl">
      {/* cabeçalho */}
      <section className="relative overflow-hidden rounded-3xl border border-borda bg-gradient-to-br from-marca/25 via-painel to-painel p-6 sm:p-10">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-marca"><Icone nome="estrela" className="size-4" /> Planeta Diário Pro</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">Saiba primeiro. Sempre.</h1>
        <p className="mt-3 max-w-xl text-suave sm:text-lg">
          As notícias que vão bombar chegam para você 30 minutos antes de todo mundo, no site e no Telegram. Sem anúncios e sem fidelidade.
        </p>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
          <b className="text-4xl">{valor}</b>
          <span className="text-suave">por 30 dias · pagamento único por PIX · não renova sozinho</span>
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="order-2 flex flex-col gap-10 lg:order-1">
          {/* benefícios */}
          <section>
            <h2 className="mb-4 text-xl font-bold">O que você ganha</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {BENEFICIOS.map(([i, t, d]) => (
                <div key={t} className="cartao flex gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca/10 text-marca"><Icone nome={i} /></span>
                  <span>
                    <b className="block">{t}</b>
                    <span className="text-sm text-suave">{d}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* grátis x Pro */}
          <section>
            <h2 className="mb-4 text-xl font-bold">Grátis ou Pro?</h2>
            <div className="cartao overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda bg-painel-2 text-left">
                    <th className="p-3 font-semibold">Recurso</th>
                    <th className="w-20 p-3 text-center font-semibold">Grátis</th>
                    <th className="w-20 p-3 text-center font-semibold text-marca">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARACAO.map(([r, g, p]) => (
                    <tr key={r} className="border-b border-borda last:border-0">
                      <td className="p-3">{r}</td>
                      <td className="p-3 text-center">{g ? <Icone nome="check" className="mx-auto size-4 text-emerald-500" /> : <span className="text-suave">—</span>}</td>
                      <td className="p-3 text-center">{p ? <Icone nome="check" className="mx-auto size-4 text-emerald-500" /> : <span className="text-suave">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* como funciona */}
          <section>
            <h2 className="mb-4 text-xl font-bold">Como funciona</h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ["Entre com o Google", "Leva 5 segundos e não precisa de senha."],
                ["Pague o PIX", "Use o QR code ou o copia e cola no app do seu banco."],
                ["Pronto, você é Pro", "A confirmação é automática e os benefícios valem na hora."],
              ].map(([t, d], i) => (
                <li key={t} className="cartao p-4">
                  <span className="grid size-8 place-items-center rounded-full bg-marca text-sm font-bold text-white">{i + 1}</span>
                  <b className="mt-3 block">{t}</b>
                  <span className="text-sm text-suave">{d}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* outras formas */}
          <section className="grid gap-3 sm:grid-cols-2">
            <a href="https://t.me/PlanetaDiarioNews_bot?start=pro" target="_blank" rel="noreferrer" className="cartao flex gap-3 p-4 transition hover:bg-painel-2">
              <IconeRede rede="telegram" className="size-9 shrink-0" />
              <span>
                <b className="block">Prefere o Telegram?</b>
                <span className="text-sm text-suave">Assine pelo nosso bot, pague o PIX lá mesmo e receba as notícias antes no seu Telegram.</span>
              </span>
            </a>
            <a href="/fundadores" onClick={aoClicar("/fundadores")} className="cartao flex gap-3 p-4 transition hover:bg-painel-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-400 text-black"><Icone nome="trofeu" className="size-5" /></span>
              <span>
                <b className="block">Clube de Fundadores</b>
                <span className="text-sm text-suave">Pagamento único: número de fundador para sempre, selo, mural e 30 dias de Pro de presente.</span>
              </span>
            </a>
          </section>

          {/* perguntas */}
          <section>
            <h2 className="mb-4 text-xl font-bold">Perguntas frequentes</h2>
            <div className="flex flex-col gap-2">
              {PERGUNTAS.map(([p, r]) => (
                <details key={p} className="cartao group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                    {p} <Icone nome="baixo" className="size-4 shrink-0 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-suave">{r}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <div className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start">
      <div className="cartao p-6">
        {leitor === undefined ? null : !leitor ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-marca/10 text-marca"><Icone nome="estrela" className="size-7" /></span>
            <p className="text-lg font-bold">Assine o Pro por {valor}</p>
            <p className="text-sm text-suave">Entre com a sua conta Google para gerar o PIX.</p>
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
        </div>
      </div>
      <p className="mt-8 text-xs text-suave">
        A assinatura dura 30 dias a partir do pagamento e não renova sozinha: avisamos no site quando estiver perto de acabar. Ao assinar, você concorda com os{" "}
        <a href="/termos" onClick={aoClicar("/termos")} className="underline">Termos de Uso</a> e a{" "}
        <a href="/privacidade" onClick={aoClicar("/privacidade")} className="underline">Política de Privacidade</a>.{" "}
        <a href="/" onClick={aoClicar("/")} className="underline">Voltar às notícias</a>
      </p>
      <SigaRedes />
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
