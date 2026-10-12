import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { aoClicar, apiSite, entrarComGoogle, navegar, numeroFundador, quando, type Leitor } from "./base";
import { Avatar, LogoGoogle, SeloAssinante, sair } from "./Site";
import { ChamadaAssinatura } from "./Inicio";
import { SeloFundador } from "./Fundadores";

type Aba = "perfil" | "atividade" | "assinatura" | "fundador" | "privacidade";

const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "perfil", nome: "Perfil", icone: "usuario" },
  { id: "atividade", nome: "Atividade", icone: "comentario" },
  { id: "assinatura", nome: "Assinatura e pagamentos", icone: "estrela" },
  { id: "fundador", nome: "Clube de Fundadores", icone: "trofeu" },
  { id: "privacidade", nome: "Privacidade e dados", icone: "cadeado" },
];

export default function Conta({ leitor }: { leitor: Leitor | null | undefined }) {
  const [aba, setAba] = useState<Aba>(() => (ABAS.some((a) => a.id === location.hash.slice(1)) ? (location.hash.slice(1) as Aba) : "perfil"));

  // o menu da foto navega para /conta#aba: troca a aba mesmo já estando aqui
  useEffect(() => {
    const f = () => {
      const h = location.hash.slice(1) as Aba;
      if (ABAS.some((a) => a.id === h)) setAba(h);
    };
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);

  if (leitor === undefined) return null;
  if (!leitor)
    return (
      <div className="py-20 text-center">
        <button onClick={() => entrarComGoogle()} className="inline-flex items-center gap-2 rounded-full border border-borda bg-painel px-5 py-2.5 font-medium">
          <LogoGoogle /> Entrar com o Google
        </button>
      </div>
    );

  function trocar(a: Aba) {
    setAba(a);
    history.replaceState({}, "", `/conta#${a}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col">
        <p className="mb-2 hidden px-3 text-lg font-bold lg:block">Configurações</p>
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => trocar(a.id)}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${aba === a.id ? "bg-painel-2 font-semibold" : "text-suave hover:bg-painel-2 hover:text-texto"}`}
          >
            <Icone nome={a.icone} className="size-[18px]" /> {a.nome}
          </button>
        ))}
      </nav>

      <div className="min-w-0 max-w-4xl">
        {aba === "perfil" && <Perfil leitor={leitor} />}
        {aba === "atividade" && <Atividade />}
        {aba === "assinatura" && <Assinatura leitor={leitor} />}
        {aba === "fundador" && <Fundador leitor={leitor} />}
        {aba === "privacidade" && <Privacidade leitor={leitor} />}
      </div>
    </div>
  );
}

function Titulo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="mb-6 border-b border-borda pb-5">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-suave">{sub}</p>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-borda py-5 last:border-0 sm:grid-cols-[200px_1fr]">
      <span className="text-sm font-semibold">{rotulo}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Perfil({ leitor }: { leitor: Leitor }) {
  const [nome, setNome] = useState(leitor.nome);
  const [salvo, setSalvo] = useState(false);
  const [posicao, setPosicao] = useState<{ posicao: number; total: number } | null>(null);

  useEffect(() => {
    supabase.rpc("minha_posicao").then(({ data }) => setPosicao((data as { posicao: number; total: number }[] | null)?.[0] ?? null));
  }, []);

  async function salvar() {
    if (nome.trim() === leitor.nome) return;
    await supabase.from("perfis").update({ nome: nome.trim() }).eq("id", leitor.user.id);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1800);
  }

  return (
    <>
      <Titulo titulo="Perfil" sub="Como você aparece no Planeta Diário" />
      <div className="mb-6 flex items-center gap-4">
        <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-20" />
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {leitor.nome} {leitor.fundador && <SeloFundador numero={leitor.fundador.numero} />} {leitor.assinante && <SeloAssinante />}
          </p>
          <p className="text-sm text-suave">{leitor.user.email}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Numero rotulo="Pontos" valor={leitor.pontos.toLocaleString("pt-BR")} icone="trofeu" />
        <Numero rotulo="Posição no ranking" valor={posicao && leitor.pontos > 0 ? `${posicao.posicao}º de ${posicao.total}` : "—"} icone="grafico" />
        <Numero rotulo="Plano" valor={leitor.assinante ? "Pro" : "Gratuito"} icone="estrela" />
      </div>
      <div className="mt-6">
        <Linha rotulo="Nome de exibição">
          <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} onBlur={salvar} className="w-full max-w-sm rounded-lg border border-borda bg-fundo px-3 py-2.5" />
          <p className="mt-1 text-xs text-suave">{salvo ? "Salvo." : "Aparece nos seus comentários e no ranking."}</p>
        </Linha>
        <Linha rotulo="Conta Google">
          <p>{leitor.user.email}</p>
          <p className="text-xs text-suave">Você entra com o Google; não guardamos senha.</p>
        </Linha>
        <Linha rotulo="Como ganhar pontos">
          <ul className="flex flex-col gap-1 text-suave">
            <li>+{leitor.assinante ? 10 : 5} por comentário (até 10 por dia)</li>
            <li>+100 a cada assinatura Pro</li>
            <li>+500 ao se tornar fundador</li>
          </ul>
        </Linha>
      </div>
    </>
  );
}

function Numero({ rotulo, valor, icone }: { rotulo: string; valor: string; icone: string }) {
  return (
    <div className="cartao flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-marca/10 text-marca"><Icone nome={icone} className="size-5" /></span>
      <span>
        <span className="block text-xs text-suave">{rotulo}</span>
        <b className="text-lg">{valor}</b>
      </span>
    </div>
  );
}

interface ItemAtividade {
  tipo: "comentario" | "curtida";
  texto: string | null;
  quando: string;
  slug: string;
  manchete: string;
  thumb_url: string | null;
}

function Atividade() {
  const [itens, setItens] = useState<ItemAtividade[] | null>(null);
  const [filtro, setFiltro] = useState<"" | "comentario" | "curtida">("");
  useEffect(() => {
    supabase.rpc("minha_atividade").then(({ data }) => setItens(data ?? []));
  }, []);
  const lista = (itens ?? []).filter((i) => !filtro || i.tipo === filtro);
  return (
    <>
      <Titulo titulo="Atividade" sub="Seus comentários e curtidas" />
      <div className="mb-4 flex gap-2 text-sm">
        {([["", "Tudo"], ["comentario", "Comentários"], ["curtida", "Curtidas"]] as const).map(([v, r]) => (
          <button key={v} onClick={() => setFiltro(v)} className={`rounded-lg px-3 py-1.5 font-medium ${filtro === v ? "bg-texto text-fundo" : "bg-painel-2"}`}>{r}</button>
        ))}
      </div>
      {itens === null ? (
        <p className="text-suave">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="py-12 text-center text-sm text-suave">Nada por aqui ainda. Comente e curta as notícias para ganhar pontos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda">
          {lista.map((i, k) => (
            <li key={k}>
              <a href={`/n/${i.slug}`} onClick={aoClicar(`/n/${i.slug}`)} className="flex gap-3 py-3 hover:opacity-80">
                <span className="aspect-[9/16] w-10 shrink-0 overflow-hidden rounded bg-black">{i.thumb_url && <img src={i.thumb_url} alt="" className="h-full w-full object-cover" />}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-suave">
                    <Icone nome={i.tipo === "curtida" ? "curtida" : "comentario"} className="size-3.5" />
                    {i.tipo === "curtida" ? "Você curtiu" : "Você comentou"} · {quando(i.quando)}
                  </span>
                  <span className="line-clamp-1 text-sm font-semibold">{i.manchete}</span>
                  {i.texto && <span className="line-clamp-2 text-sm text-suave">“{i.texto}”</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface Pagamento {
  tipo: string;
  status: string;
  valor_centavos: number;
  criado_em: string;
}

function Assinatura({ leitor }: { leitor: Leitor }) {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from("assinaturas").select("status, valor_centavos, criado_em").eq("usuario_id", leitor.user.id).order("criado_em", { ascending: false }),
      supabase.from("fundadores").select("status, valor_centavos, criado_em").eq("usuario_id", leitor.user.id).order("criado_em", { ascending: false }),
    ]).then(([a, f]) =>
      setPagamentos(
        [
          ...(a.data ?? []).map((p) => ({ ...p, tipo: p.valor_centavos === 0 ? "Pro de presente (fundador)" : "Assinatura Pro (30 dias)" })),
          ...(f.data ?? []).map((p) => ({ ...p, tipo: "Clube de Fundadores" })),
        ].sort((x, y) => y.criado_em.localeCompare(x.criado_em)),
      ),
    );
  }, [leitor.user.id]);

  const dias = leitor.fimAssinatura ? Math.ceil((Date.parse(leitor.fimAssinatura) - Date.now()) / 86400_000) : 0;

  return (
    <>
      <Titulo titulo="Assinatura e pagamentos" sub="Seu plano e o histórico de pagamentos" />
      {leitor.assinante ? (
        <div className="cartao mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="flex items-center gap-2 font-semibold"><SeloAssinante /> Planeta Diário Pro ativo</p>
            <p className="text-sm text-suave">Válido até {new Date(leitor.fimAssinatura!).toLocaleDateString("pt-BR")} ({dias} {dias === 1 ? "dia" : "dias"})</p>
          </div>
          <a href="/assinar" onClick={aoClicar("/assinar")} className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white">Renovar por mais 30 dias</a>
        </div>
      ) : (
        <div className="mb-6 max-w-md"><ChamadaAssinatura /></div>
      )}
      <h2 className="mb-2 font-semibold">Histórico</h2>
      {pagamentos.length === 0 ? (
        <p className="text-sm text-suave">Nenhum pagamento ainda.</p>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {pagamentos.map((p, i) => {
                const pago = p.status === "ativa" || p.status === "ativo";
                return (
                  <tr key={i} className="border-b border-borda last:border-0">
                    <td className="p-3">{p.tipo}</td>
                    <td className="p-3 text-suave">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3 tabular-nums">{(p.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${pago ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2 text-suave"}`}>
                        {pago ? "Pago" : p.status === "pendente" ? "Aguardando" : p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Fundador({ leitor }: { leitor: Leitor }) {
  const f = leitor.fundador;
  const [nome, setNome] = useState(f?.nome_mural ?? leitor.nome);
  const [mostrar, setMostrar] = useState(f?.mostrar_mural ?? true);
  const [salvo, setSalvo] = useState(false);

  if (!f)
    return (
      <>
        <Titulo titulo="Clube de Fundadores" sub="Número eterno, selo exclusivo e seu nome no mural" />
        <div className="cartao flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="max-w-md text-sm text-suave">Por R$ 15,90, uma única vez, você entra para a história do Planeta Diário com um número de fundador só seu.</p>
          <a href="/fundadores" onClick={aoClicar("/fundadores")} className="rounded-full bg-marca px-5 py-2.5 font-semibold text-white">Quero ser fundador</a>
        </div>
      </>
    );

  async function salvar(dados: { nome_mural?: string; mostrar_mural?: boolean }) {
    await supabase.from("fundadores").update(dados).eq("id", f!.id);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <>
      <Titulo titulo="Clube de Fundadores" sub={`Fundador desde ${new Date(f.pago_em).toLocaleDateString("pt-BR")}`} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#2a0a0e] to-black p-6 text-white">
        <div>
          <p className="text-sm text-white/60">Seu número</p>
          <p className="text-4xl font-bold">{numeroFundador(f.numero)}</p>
          <div className="mt-2"><SeloFundador numero={f.numero} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navegar("/fundadores/certificado")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Certificado</button>
          <button onClick={() => navegar("/fundadores/votacao")} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Votar nas pautas</button>
          <button onClick={() => navegar("/fundadores/mural")} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Ver mural</button>
        </div>
      </div>
      <Linha rotulo="Nome no mural">
        <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} onBlur={() => salvar({ nome_mural: nome })} className="w-full max-w-sm rounded-lg border border-borda bg-fundo px-3 py-2.5" />
        {salvo && <p className="mt-1 text-xs text-emerald-500">Salvo.</p>}
      </Linha>
      <Linha rotulo="Aparecer no mural">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={mostrar}
            onChange={(e) => {
              setMostrar(e.target.checked);
              salvar({ mostrar_mural: e.target.checked });
            }}
            className="size-4 accent-marca"
          />
          Mostrar meu nome no Mural dos Fundadores
        </label>
      </Linha>
    </>
  );
}

function Privacidade({ leitor }: { leitor: Leitor }) {
  const [confirma, setConfirma] = useState("");
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");

  async function apagar() {
    setApagando(true);
    setErro("");
    try {
      await apiSite("/conta", { method: "DELETE" });
      await sair();
      location.assign("/");
    } catch (e) {
      setErro((e as Error).message);
      setApagando(false);
    }
  }

  return (
    <>
      <Titulo titulo="Privacidade e dados" sub="Seus dados, sob seu controle (LGPD)" />
      <Linha rotulo="Dados que guardamos">
        <ul className="flex flex-col gap-1 text-suave">
          <li>Nome, e-mail e foto da sua conta Google</li>
          <li>Seus comentários, curtidas e pontos</li>
          <li>Pagamentos (sem dados de cartão; o CPF vai só para a Lytex emitir o PIX)</li>
        </ul>
      </Linha>
      <Linha rotulo="Sair">
        <button onClick={() => sair().then(() => navegar("/"))} className="flex items-center gap-2 rounded-lg border border-borda px-4 py-2 hover:bg-painel-2">
          <Icone nome="sair" className="size-4" /> Sair desta conta
        </button>
      </Linha>
      <Linha rotulo="Excluir conta">
        <p className="mb-2 text-suave">Apaga sua conta, comentários, curtidas e pontos. Fundadores perdem o número e o selo. Não dá para desfazer.</p>
        <input value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder={`Digite ${leitor.user.email} para confirmar`} className="mb-2 w-full max-w-sm rounded-lg border border-borda bg-fundo px-3 py-2.5" />
        <div>
          <button disabled={confirma !== leitor.user.email || apagando} onClick={apagar} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40">
            {apagando ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </div>
        {erro && <p className="mt-2 text-red-500">{erro}</p>}
      </Linha>
    </>
  );
}
