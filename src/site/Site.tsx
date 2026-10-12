import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import Icone from "../Icone";
import { aoClicar, entrarComGoogle, navegar, useCaminho, useLeitor, type Leitor } from "./base";
import Inicio from "./Inicio";
import PaginaNoticia from "./PaginaNoticia";
import ModoReels from "./ModoReels";
import Assinar from "./Assinar";
import Conta from "./Conta";
import Busca from "./Busca";
import Fundadores from "./Fundadores";
import { Privacidade, Termos } from "./Legal";
import { ColunaDireita, ColunaEsquerda } from "./Colunas";
import { SeloFundador } from "./Fundadores";
import { useInstalar } from "../pwa";

function lerPreferencia(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravarPreferencia(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem storage */
  }
}

export default function Site() {
  const caminho = useCaminho();
  const leitor = useLeitor();
  const [, setTema] = useState(0);
  const [gaveta, setGaveta] = useState(false);
  const [recolhida, setRecolhida] = useState(() => lerPreferencia("coluna") === "recolhida");
  const [termo, setTermo] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [buscaMovel, setBuscaMovel] = useState(false);

  const partes = caminho.split("/").filter(Boolean);
  if (partes[0] === "reels") return <ModoReels leitor={leitor} inicio={partes[1]} />;

  function alternarTema() {
    const escuro = document.documentElement.classList.toggle("dark");
    gravarPreferencia("tema", escuro ? "escuro" : "claro");
    setTema((t) => t + 1);
  }
  function alternarColuna() {
    setRecolhida(!recolhida);
    gravarPreferencia("coluna", recolhida ? "aberta" : "recolhida");
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!termo.trim()) return;
    setBuscaMovel(false);
    navegar(`/busca?q=${encodeURIComponent(termo.trim())}`);
  }

  let pagina: React.ReactNode;
  if (partes[0] === "n" && partes[1]) pagina = <PaginaNoticia slug={partes[1]} leitor={leitor} />;
  else if (partes[0] === "assinar") pagina = <Assinar leitor={leitor} />;
  else if (partes[0] === "conta") pagina = <Conta leitor={leitor} />;
  else if (partes[0] === "privacidade") pagina = <Privacidade />;
  else if (partes[0] === "termos") pagina = <Termos />;
  else if (partes[0] === "fundadores") pagina = <Fundadores leitor={leitor} sub={partes[1]} />;
  else if (partes[0] === "busca") pagina = <Busca termo={new URLSearchParams(window.location.search).get("q") ?? ""} />;
  else pagina = <Inicio categoria={partes[0] === "c" ? partes[1] : undefined} leitor={leitor} />;

  const formBusca = (classe: string) => (
    <form onSubmit={buscar} className={`flex items-center ${classe}`} role="search">
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Pesquisar notícias"
        aria-label="Pesquisar notícias"
        className="h-10 min-w-0 flex-1 rounded-l-full border border-borda bg-fundo px-4 text-sm outline-none focus:border-globo"
      />
      <button aria-label="Pesquisar" className="grid h-10 w-16 place-items-center rounded-r-full border border-l-0 border-borda bg-painel-2 hover:bg-borda">
        <Icone nome="busca" className="size-5" />
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
      {/* cabeçalho fixo */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-borda bg-fundo/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <button
            onClick={alternarColuna}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            className="hidden size-10 place-items-center rounded-full hover:bg-painel-2 lg:grid"
          >
            <Icone nome="menu" />
          </button>
          <a href="/" onClick={aoClicar("/")} className="shrink-0">
            <img src="/logo-claro.png" alt="Planeta Diário" className="h-8 dark:hidden" />
            <img src="/logo.png" alt="Planeta Diário" className="hidden h-8 dark:block" />
          </a>

          {formBusca("mx-auto hidden w-full max-w-xl md:flex")}

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <button onClick={() => setBuscaMovel(true)} aria-label="Pesquisar" className="grid size-9 place-items-center rounded-full hover:bg-painel-2 md:hidden">
              <Icone nome="busca" className="size-5" />
            </button>
            <button onClick={alternarTema} aria-label="Alternar tema" className="grid size-9 place-items-center rounded-full text-suave hover:bg-painel-2 hover:text-texto">
              <Icone nome="lua" className="size-[18px] dark:hidden" />
              <Icone nome="sol" className="hidden size-[18px] dark:block" />
            </button>
            {leitor?.admin && (
              <a href="/painel" className="hidden rounded-full bg-texto px-3 py-1.5 text-sm font-semibold text-fundo sm:block">Painel</a>
            )}
            <BotaoConta leitor={leitor} alternarTema={alternarTema} />
          </div>
        </div>
        {buscaMovel && (
          <div className="flex items-center gap-2 border-t border-borda px-3 py-2 md:hidden">
            <button onClick={() => setBuscaMovel(false)} aria-label="Fechar busca" className="grid size-9 place-items-center rounded-full hover:bg-painel-2">
              <Icone nome="esquerda" />
            </button>
            {formBusca("flex-1")}
          </div>
        )}
      </header>

      {/* menu esquerdo fixo (só o conteúdo rola) */}
      <aside
        className={`fixed bottom-0 left-0 top-14 z-20 hidden overflow-y-auto bg-fundo pt-[env(safe-area-inset-top)] [scrollbar-width:thin] lg:block ${recolhida ? "w-[76px] px-1" : "w-60"}`}
      >
        <ColunaEsquerda caminho={caminho} leitor={leitor} recolhida={recolhida} />
      </aside>

      <div className={`pt-[calc(3.5rem+env(safe-area-inset-top))] ${recolhida ? "lg:pl-[76px]" : "lg:pl-60"}`}>
        <div className="grid gap-6 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <main className="min-w-0">
            <AvisoRenovacao leitor={leitor} />
            {pagina}
          </main>
          <aside className="hidden xl:block">
            <div className="sticky top-[4.75rem] max-h-[calc(100dvh-6rem)] overflow-y-auto pb-6 [scrollbar-width:thin]">
              <ColunaDireita leitor={leitor} />
            </div>
          </aside>
        </div>
      </div>

      {/* barra inferior estilo app (celular/tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borda bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <AbaApp ativo={partes.length === 0} icone="inicio" rotulo="Início" onClick={() => navegar("/")} />
        <AbaApp ativo={false} icone="reels" rotulo="Reels" onClick={() => navegar("/reels")} />
        <AbaApp ativo={gaveta} icone="categorias" rotulo="Explorar" onClick={() => setGaveta(true)} />
        <AbaApp
          ativo={partes[0] === "conta" || partes[0] === "assinar"}
          icone="usuario"
          rotulo={leitor ? "Conta" : "Entrar"}
          onClick={() => (leitor ? navegar("/conta") : entrarComGoogle())}
        />
      </nav>

      {/* gaveta "Explorar" (celular) */}
      {gaveta && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setGaveta(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 w-[88%] max-w-sm overflow-y-auto bg-fundo px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <b>Explorar</b>
              <button onClick={() => setGaveta(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-full hover:bg-painel-2">
                <Icone nome="fechar" />
              </button>
            </div>
            <ColunaEsquerda caminho={caminho} leitor={leitor} recolhida={false} aoNavegar={() => setGaveta(false)} />
            <div className="mt-5">
              <ColunaDireita leitor={leitor} aoNavegar={() => setGaveta(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AbaApp({ ativo, icone, rotulo, onClick }: { ativo: boolean; icone: string; rotulo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${ativo ? "text-marca" : "text-suave"}`}>
      <Icone nome={icone} className="size-[22px]" />
      {rotulo}
    </button>
  );
}

function BotaoConta({ leitor, alternarTema }: { leitor: Leitor | null | undefined; alternarTema: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const instalar = useInstalar();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (leitor === undefined) return <span className="size-9" />;
  if (!leitor)
    return (
      <button onClick={() => entrarComGoogle()} className="hidden items-center gap-2 rounded-full border border-borda bg-painel px-3 py-1.5 text-sm font-medium hover:bg-painel-2 sm:flex">
        <LogoGoogle /> Entrar
      </button>
    );

  const ir = (caminho: string) => {
    setAberto(false);
    navegar(caminho);
  };
  const Item = ({ icone, rotulo, onClick, seta }: { icone: string; rotulo: string; onClick: () => void; seta?: boolean }) => (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-painel-2">
      <Icone nome={icone} className="size-5 shrink-0" />
      <span className="flex-1">{rotulo}</span>
      {seta && <Icone nome="direita" className="size-4 text-suave" />}
    </button>
  );
  const escuro = document.documentElement.classList.contains("dark");

  return (
    <div ref={caixa} className="relative">
      <button
        onClick={() => setAberto(!aberto)}
        aria-label="Menu da conta"
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-full border border-borda bg-painel p-1 text-sm hover:bg-painel-2 sm:pr-3"
      >
        <Avatar nome={leitor.nome} url={leitor.avatar} />
        <span className="hidden max-w-28 truncate sm:inline">{leitor.nome.split(" ")[0]}</span>
        {leitor.fundador ? <span className="hidden sm:inline"><SeloFundador numero={leitor.fundador.numero} compacto /></span> : leitor.assinante && <SeloAssinante />}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[80dvh] w-80 overflow-y-auto rounded-xl border border-borda bg-painel py-2 shadow-2xl">
          <div className="flex gap-3 px-4 pb-3 pt-1">
            <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{leitor.nome}</p>
              <p className="truncate text-sm text-suave">{leitor.user.email}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {leitor.fundador && <SeloFundador numero={leitor.fundador.numero} />}
                {leitor.assinante && <SeloAssinante />}
              </div>
              <button onClick={() => ir("/conta")} className="mt-1 text-sm font-medium text-globo hover:underline">Ver minha conta</button>
            </div>
          </div>
          <div className="border-t border-borda py-1">
            <Item icone="usuario" rotulo="Perfil e pontos" onClick={() => ir("/conta#perfil")} />
            <Item icone="comentario" rotulo="Minha atividade" onClick={() => ir("/conta#atividade")} />
            <Item icone="estrela" rotulo={leitor.assinante ? "Minha assinatura Pro" : "Assinar o Pro"} onClick={() => ir(leitor.assinante ? "/conta#assinatura" : "/assinar")} />
          </div>
          <div className="border-t border-borda py-1">
            {leitor.fundador ? (
              <>
                <Item icone="jornal" rotulo="Meu certificado de fundador" onClick={() => ir("/fundadores/certificado")} />
                <Item icone="checkCirculo" rotulo="Votação de pautas" onClick={() => ir("/fundadores/votacao")} />
              </>
            ) : (
              <Item icone="trofeu" rotulo="Ser fundador por R$ 15,90" onClick={() => ir("/fundadores")} />
            )}
            <Item icone="usuario" rotulo="Mural dos Fundadores" onClick={() => ir("/fundadores/mural")} />
          </div>
          <div className="border-t border-borda py-1">
            <Item icone={escuro ? "sol" : "lua"} rotulo={`Aparência: ${escuro ? "escuro" : "claro"}`} onClick={alternarTema} />
            {instalar?.tipo === "prompt" && <Item icone="instalar" rotulo="Instalar o app" onClick={() => instalar.instalar()} />}
            {leitor.admin && (
              <Item
                icone="ajustes"
                rotulo="Painel admin"
                onClick={() => {
                  window.location.href = "/painel";
                }}
              />
            )}
          </div>
          <div className="border-t border-borda py-1">
            <Item icone="cadeado" rotulo="Privacidade e dados" onClick={() => ir("/conta#privacidade")} />
            <Item
              icone="sair"
              rotulo="Sair"
              onClick={() => {
                setAberto(false);
                sair().then(() => navegar("/"));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function Avatar({ nome, url, tamanho = "size-7" }: { nome: string; url: string | null; tamanho?: string }) {
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className={`${tamanho} rounded-full object-cover`} />
  ) : (
    <span className={`${tamanho} grid place-items-center rounded-full bg-globo text-xs font-bold text-white`}>{nome.slice(0, 1).toUpperCase()}</span>
  );
}

export function SeloAssinante() {
  return (
    <span title="Assinante" className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">
      Pro
    </span>
  );
}

export function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function sair() {
  return supabase.auth.signOut();
}

/** Aviso no topo quando a assinatura Pro vence em até 5 dias (PIX não renova sozinho) */
function AvisoRenovacao({ leitor }: { leitor: Leitor | null | undefined }) {
  if (!leitor?.assinante || !leitor.fimAssinatura) return null;
  const dias = Math.ceil((Date.parse(leitor.fimAssinatura) - Date.now()) / 86400_000);
  if (dias > 5) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <Icone nome="info" className="size-4 text-amber-500" />
        Sua assinatura Pro vence {dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}. Renove para não perder os benefícios.
      </span>
      <a href="/assinar" onClick={aoClicar("/assinar")} className="rounded-full bg-amber-500 px-4 py-1.5 font-semibold text-black">Renovar</a>
    </div>
  );
}
