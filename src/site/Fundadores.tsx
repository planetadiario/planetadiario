import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { aoClicar, apiSite, entrarComGoogle, navegar, numeroFundador, seloDoNumero, type Leitor, type Selo } from "./base";
import { Avatar, LogoGoogle } from "./Site";

interface Clube {
  total: number;
  meta: number;
  preco_centavos: number;
  dias_pro: number;
  ultimo_numero: number | null;
}

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const SELOS: Record<Selo, { nome: string; faixa: string; classe: string }> = {
  pioneiro: { nome: "Pioneiro", faixa: "nº 1 a 1.000", classe: "from-amber-300 to-amber-600 text-black" },
  fundador: { nome: "Fundador", faixa: "nº 1.001 a 10.000", classe: "from-slate-200 to-slate-400 text-black" },
  apoiador: { nome: "Apoiador Fundador", faixa: "a partir do nº 10.001", classe: "from-marca to-[#9b0b12] text-white" },
};

/** Selo de fundador com o número (usado em comentários, menu e perfil) */
export function SeloFundador({ numero, compacto = false }: { numero: number; compacto?: boolean }) {
  const s = SELOS[seloDoNumero(numero)];
  return (
    <span title={`${s.nome} ${numeroFundador(numero)}`} className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.classe}`}>
      <Icone nome="estrela" className="size-3" preenchido />
      {compacto ? numeroFundador(numero) : `${s.nome} ${numeroFundador(numero)}`}
    </span>
  );
}

const BENEFICIOS = [
  ["estrela", "Número de fundador eterno", "Seu número (#00001…) é só seu, para sempre. Quanto antes, menor."],
  ["trofeu", "Selo exclusivo", "Pioneiro, Fundador ou Apoiador, de acordo com a ordem de chegada. Aparece nos seus comentários."],
  ["usuario", "Nome no Mural dos Fundadores", "Seu nome registrado na história do Planeta Diário."],
  ["checkCirculo", "Vote nas pautas", "Fundadores escolhem temas e coberturas que vamos fazer."],
  ["jornal", "Certificado digital", "Certificado com seu número de fundador para guardar e compartilhar."],
  ["raio", "Pro grátis de presente", "Dias de Planeta Diário Pro: notícias antes, sem anúncios e conteúdo exclusivo."],
];

export default function Fundadores({ leitor, sub }: { leitor: Leitor | null | undefined; sub?: string }) {
  if (sub === "mural") return <Mural />;
  if (sub === "votacao") return <Votacao leitor={leitor} />;
  if (sub === "certificado") return <Certificado leitor={leitor} />;
  return <Pagina leitor={leitor} />;
}

function Pagina({ leitor }: { leitor: Leitor | null | undefined }) {
  const [clube, setClube] = useState<Clube | null>(null);
  useEffect(() => {
    supabase.rpc("clube_fundadores").then(({ data }) => setClube((data as Clube[] | null)?.[0] ?? null));
  }, []);

  const proximo = (clube?.ultimo_numero ?? 0) + 1;
  const seloProximo = SELOS[seloDoNumero(proximo)];
  const pct = clube ? Math.min(100, (clube.total / Math.max(1, clube.meta)) * 100) : 0;

  return (
    <div className="flex flex-col gap-10">
      {/* topo */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0507] via-[#2a0a0e] to-black p-6 text-white sm:p-10">
        <div className="absolute -right-10 -top-10 size-64 rounded-full bg-marca/20 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Icone nome="estrela" className="size-3.5" preenchido /> Clube de Fundadores
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Faça parte da história do Planeta Diário</h1>
            <p className="mt-4 max-w-xl text-white/75">
              Por <b className="text-white">{clube ? reais(clube.preco_centavos) : "R$ 15,90"}</b>, uma única vez, você ganha um número de fundador eterno, selo exclusivo e seu nome no mural. Sem mensalidade.
            </p>
            {clube && (
              <div className="mt-6 max-w-md">
                <div className="mb-2 flex justify-between text-sm">
                  <span><b className="text-xl">{clube.total.toLocaleString("pt-BR")}</b> fundadores</span>
                  <span className="text-white/60">meta {clube.meta.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-marca" style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  Próximo número: <b className="text-white">{numeroFundador(proximo)}</b> · selo <b className="text-white">{seloProximo.nome}</b>
                </p>
              </div>
            )}
          </div>
          <Compra leitor={leitor} clube={clube} />
        </div>
      </section>

      {/* selos */}
      <section>
        <h2 className="mb-4 text-xl font-bold">Quanto antes, mais raro o seu selo</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(SELOS) as Selo[]).map((s) => (
            <div key={s} className="cartao p-5">
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1 text-sm font-bold ${SELOS[s].classe}`}>
                <Icone nome="estrela" className="size-4" preenchido /> {SELOS[s].nome}
              </span>
              <p className="mt-3 text-sm text-suave">Fundadores {SELOS[s].faixa}</p>
            </div>
          ))}
        </div>
      </section>

      {/* benefícios */}
      <section>
        <h2 className="mb-4 text-xl font-bold">O que você ganha</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BENEFICIOS.map(([icone, titulo, texto]) => (
            <div key={titulo} className="cartao flex gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca/10 text-marca"><Icone nome={icone} /></span>
              <span>
                <b className="block">{titulo === "Pro grátis de presente" && clube ? `${clube.dias_pro} dias de Pro grátis` : titulo}</b>
                <span className="text-sm text-suave">{texto}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <a href="/fundadores/mural" onClick={aoClicar("/fundadores/mural")} className="flex items-center gap-2 rounded-full border border-borda px-4 py-2 text-sm font-semibold hover:bg-painel-2">
          <Icone nome="usuario" className="size-4" /> Ver o Mural dos Fundadores
        </a>
        <a href="/fundadores/votacao" onClick={aoClicar("/fundadores/votacao")} className="flex items-center gap-2 rounded-full border border-borda px-4 py-2 text-sm font-semibold hover:bg-painel-2">
          <Icone nome="checkCirculo" className="size-4" /> Votação de pautas
        </a>
      </div>

      {/* perguntas */}
      <section className="cartao divide-y divide-borda">
        {[
          ["Preciso pagar todo mês?", "Não. É um pagamento único. Você é fundador para sempre."],
          ["Vira sócio ou investidor da empresa?", "Não. O Clube de Fundadores é um apoio ao Planeta Diário com benefícios no site. Não é participação societária, investimento nem promessa de retorno financeiro."],
          ["Como recebo meu número?", "Assim que o PIX é confirmado (em segundos), seu número e selo aparecem no seu perfil, junto com o certificado."],
          ["Posso esconder meu nome do mural?", "Pode. Em Minha conta você escolhe o nome que aparece ou oculta do mural."],
        ].map(([p, r]) => (
          <details key={p} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              {p} <Icone nome="baixo" className="size-4 transition group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-suave">{r}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

function Compra({ leitor, clube }: { leitor: Leitor | null | undefined; clube: Clube | null }) {
  const [cpf, setCpf] = useState("");
  const [tel, setTel] = useState("");
  const [nome, setNome] = useState("");
  const [pix, setPix] = useState<{ codigo: string; qr: string } | null>(null);
  const [estado, setEstado] = useState<"" | "gerando" | "aguardando">("");
  const [numero, setNumero] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => {
    if (leitor && !nome) setNome(leitor.nome);
  }, [leitor, nome]);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEstado("gerando");
    try {
      const r = await apiSite<{ fatura: string; pix: string }>("/fundador", { method: "POST", body: JSON.stringify({ cpf, telefone: tel, nome_mural: nome }) });
      setPix({ codigo: r.pix, qr: await QRCode.toDataURL(r.pix, { width: 260, margin: 1 }) });
      setEstado("aguardando");
      timer.current = window.setInterval(async () => {
        const s = await apiSite<{ status: string; numero?: number }>(`/fundador/${r.fatura}`).catch(() => null);
        if (s?.status === "ativo") {
          window.clearInterval(timer.current);
          setNumero(s.numero ?? null);
        }
      }, 4000);
    } catch (e) {
      setErro((e as Error).message);
      setEstado("");
    }
  }

  const caixa = "rounded-2xl bg-white p-6 text-gray-900 shadow-2xl";

  if (leitor?.fundador)
    return (
      <div className={`${caixa} text-center`}>
        <p className="text-sm text-gray-500">Você já é</p>
        <div className="my-2"><SeloFundador numero={leitor.fundador.numero} /></div>
        <p className="text-4xl font-bold">{numeroFundador(leitor.fundador.numero)}</p>
        <button onClick={() => navegar("/fundadores/certificado")} className="mt-4 w-full rounded-full bg-marca py-2.5 font-semibold text-white">Ver meu certificado</button>
      </div>
    );

  if (numero)
    return (
      <div className={`${caixa} text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Icone nome="checkCirculo" className="size-8" /></span>
        <p className="mt-3 text-sm text-gray-500">Bem-vindo, fundador</p>
        <p className="text-4xl font-bold">{numeroFundador(numero)}</p>
        <div className="my-2"><SeloFundador numero={numero} /></div>
        <button onClick={() => window.location.assign("/fundadores/certificado")} className="mt-3 w-full rounded-full bg-marca py-2.5 font-semibold text-white">Ver meu certificado</button>
      </div>
    );

  if (pix)
    return (
      <div className={`${caixa} flex flex-col items-center gap-3 text-center`}>
        <p className="font-semibold">Pague {clube ? reais(clube.preco_centavos) : ""} com PIX</p>
        <img src={pix.qr} alt="QR Code PIX" className="size-52" />
        <button
          onClick={() => navigator.clipboard.writeText(pix.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); })}
          className="w-full rounded-full bg-marca py-2.5 font-semibold text-white"
        >
          {copiado ? "Código copiado" : "Copiar PIX copia e cola"}
        </button>
        <p className="flex items-center gap-2 text-sm text-gray-500"><span className="size-2 animate-pulse rounded-full bg-amber-500" /> Aguardando o pagamento…</p>
      </div>
    );

  if (leitor === null)
    return (
      <div className={`${caixa} flex flex-col items-center gap-3 text-center`}>
        <p className="font-semibold">Entre para garantir seu número</p>
        <button onClick={() => entrarComGoogle()} className="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-50">
          <LogoGoogle /> Entrar com o Google
        </button>
      </div>
    );

  return (
    <form onSubmit={gerar} className={`${caixa} flex flex-col gap-3`}>
      <p className="text-lg font-bold">Quero ser fundador</p>
      <label className="text-sm">
        <span className="mb-1 block text-gray-500">Nome no mural</span>
        <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-500">CPF (exigido pelo PIX)</span>
        <input required inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-500">Celular (opcional)</span>
        <input inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button disabled={estado === "gerando" || leitor === undefined} className="rounded-full bg-marca py-3 font-semibold text-white disabled:opacity-60">
        {estado === "gerando" ? "Gerando PIX…" : `Ser fundador por ${clube ? reais(clube.preco_centavos) : "R$ 15,90"}`}
      </button>
      <p className="text-center text-[11px] text-gray-500">
        Pagamento único. Não é participação societária nem investimento. Ao continuar, você concorda com os{" "}
        <a href="/termos" onClick={aoClicar("/termos")} className="underline">Termos</a> e a{" "}
        <a href="/privacidade" onClick={aoClicar("/privacidade")} className="underline">Privacidade</a>.
      </p>
    </form>
  );
}

function Mural() {
  const [lista, setLista] = useState<{ numero: number; nome: string; avatar: string | null; selo: Selo }[] | null>(null);
  useEffect(() => {
    supabase.rpc("mural_fundadores", { p_limite: 500 }).then(({ data }) => setLista(data ?? []));
  }, []);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mural dos Fundadores</h1>
          <p className="text-sm text-suave">As pessoas que fizeram o Planeta Diário acontecer.</p>
        </div>
        <a href="/fundadores" onClick={aoClicar("/fundadores")} className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white">Quero ser fundador</a>
      </div>
      {lista === null ? (
        <p className="text-suave">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="py-16 text-center text-suave">O mural está esperando o fundador {numeroFundador(1)}. Pode ser você.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {lista.map((f) => (
            <div key={f.numero} className="cartao flex flex-col items-center gap-2 p-4 text-center">
              <Avatar nome={f.nome} url={f.avatar} tamanho="size-12" />
              <b className="line-clamp-1 text-sm">{f.nome}</b>
              <SeloFundador numero={f.numero} compacto />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Enquete {
  id: string;
  pergunta: string;
  opcoes: string[];
  aberta: boolean;
  votos: number[];
  total: number;
  meu_voto: number | null;
}

function Votacao({ leitor }: { leitor: Leitor | null | undefined }) {
  const [enquetes, setEnquetes] = useState<Enquete[] | null>(null);
  const [erro, setErro] = useState("");
  const carregar = () => supabase.rpc("resultado_enquetes").then(({ data }) => setEnquetes(data ?? []));
  useEffect(() => {
    carregar();
  }, [leitor]);

  async function votar(e: Enquete, i: number) {
    setErro("");
    const { error } = await supabase.rpc("votar", { p_enquete: e.id, p_opcao: i });
    if (error) setErro(error.message);
    else carregar();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Votação de pautas</h1>
      <p className="mb-6 text-sm text-suave">Os fundadores decidem temas e coberturas do Planeta Diário.</p>
      {!leitor?.fundador && (
        <div className="cartao mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Só fundadores votam. Você pode acompanhar os resultados.</p>
          <a href="/fundadores" onClick={aoClicar("/fundadores")} className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white">Ser fundador</a>
        </div>
      )}
      {erro && <p className="mb-3 text-sm text-red-500">{erro}</p>}
      {enquetes === null ? (
        <p className="text-suave">Carregando…</p>
      ) : enquetes.length === 0 ? (
        <p className="py-12 text-center text-suave">Nenhuma votação aberta no momento.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {enquetes.map((e) => (
            <section key={e.id} className="cartao p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="font-semibold">{e.pergunta}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.aberta ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2 text-suave"}`}>
                  {e.aberta ? "Aberta" : "Encerrada"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {e.opcoes.map((o, i) => {
                  const pct = e.total ? Math.round((e.votos[i] / e.total) * 100) : 0;
                  return (
                    <button
                      key={i}
                      disabled={!e.aberta || !leitor?.fundador}
                      onClick={() => votar(e, i)}
                      className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm disabled:cursor-default ${e.meu_voto === i ? "border-marca" : "border-borda"}`}
                    >
                      <span className="absolute inset-y-0 left-0 bg-marca/15" style={{ width: `${pct}%` }} />
                      <span className="relative flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">{e.meu_voto === i && <Icone nome="check" className="size-4 text-marca" />}{o}</span>
                        <b className="tabular-nums">{pct}%</b>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-suave">{e.total} voto{e.total === 1 ? "" : "s"}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Certificado({ leitor }: { leitor: Leitor | null | undefined }) {
  if (leitor === undefined) return null;
  if (!leitor?.fundador)
    return (
      <div className="py-16 text-center">
        <p className="mb-3">Você ainda não é fundador.</p>
        <a href="/fundadores" onClick={aoClicar("/fundadores")} className="rounded-full bg-marca px-5 py-2.5 font-semibold text-white">Quero ser fundador</a>
      </div>
    );
  const f = leitor.fundador;
  const s = SELOS[seloDoNumero(f.numero)];
  return (
    <div className="flex flex-col items-center gap-4">
      <div id="certificado" className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-8 border-double border-amber-500/60 bg-gradient-to-br from-[#fffaf0] to-[#f6ead2] p-8 text-center text-gray-900 shadow-xl sm:p-12">
        <img src="/globo.png" alt="" className="mx-auto mb-3 h-16" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">Certificado de Fundador</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl">{f.nome_mural || leitor.nome}</h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-600">
          é reconhecido(a) como <b>{s.nome}</b> do Planeta Diário, tendo apoiado a construção do portal desde o início.
        </p>
        <p className="mt-6 text-5xl font-bold text-amber-700">{numeroFundador(f.numero)}</p>
        <p className="mt-6 text-sm text-gray-500">Emitido em {new Date(f.pago_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · planetadiario.online</p>
        <p className="mt-2 text-[10px] text-gray-400">Certificado simbólico de apoio. Não representa participação societária nem investimento.</p>
      </div>
      <div className="flex gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-marca px-5 py-2.5 font-semibold text-white">
          <Icone nome="baixar" className="size-4" /> Salvar / imprimir
        </button>
        <button
          onClick={() => navigator.share?.({ title: "Sou fundador do Planeta Diário", text: `Sou o fundador ${numeroFundador(f.numero)} do Planeta Diário!`, url: `${location.origin}/fundadores` })}
          className="flex items-center gap-2 rounded-full border border-borda px-5 py-2.5 font-semibold hover:bg-painel-2"
        >
          <Icone nome="compartilhar" className="size-4" /> Compartilhar
        </button>
      </div>
    </div>
  );
}
