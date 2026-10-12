import { aoClicar, entrarComGoogle, navegar, type Leitor } from "./base";
import { Avatar, LogoGoogle, SeloAssinante, sair } from "./Site";
import { ChamadaAssinatura } from "./Inicio";
import { useState } from "react";
import { supabase } from "../supabase";
import { numeroFundador } from "./base";
import { SeloFundador } from "./Fundadores";

export default function Conta({ leitor }: { leitor: Leitor | null | undefined }) {
  if (leitor === undefined) return null;
  if (!leitor)
    return (
      <div className="py-20 text-center">
        <button onClick={() => entrarComGoogle()} className="inline-flex items-center gap-2 rounded-full border border-borda bg-painel px-5 py-2.5 font-medium">
          <LogoGoogle /> Entrar com o Google
        </button>
      </div>
    );

  const dias = leitor.fimAssinatura ? Math.ceil((new Date(leitor.fimAssinatura).getTime() - Date.now()) / 86400_000) : 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
      <div className="cartao flex flex-col items-center gap-3 p-6 text-center md:col-span-2 md:flex-row md:text-left">
        <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-16" />
        <div className="flex-1">
          <p className="flex items-center justify-center gap-2 text-xl font-bold md:justify-start">
            {leitor.nome} {leitor.assinante && <SeloAssinante />}
          </p>
          <p className="text-sm text-suave">{leitor.user.email}</p>
        </div>
        <button onClick={() => sair().then(() => navegar("/"))} className="rounded-full border border-borda px-4 py-2 text-sm hover:bg-painel-2">
          Sair
        </button>
      </div>

      <div className="cartao p-6">
        <p className="text-sm text-suave">Seus pontos</p>
        <p className="text-4xl font-bold tabular-nums">{leitor.pontos}</p>
        <p className="mt-2 text-sm text-suave">
          +{leitor.assinante ? 10 : 5} por comentário · +100 a cada assinatura. Os leitores com mais pontos aparecem no ranking da capa.
        </p>
      </div>

      {leitor.fundador ? <CartaoFundador leitor={leitor} /> : null}

      {leitor.assinante ? (
        <div className="cartao p-6">
          <p className="text-sm text-suave">Assinatura Pro</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Ativa</p>
          <p className="mt-2 text-sm text-suave">
            Válida até {new Date(leitor.fimAssinatura!).toLocaleDateString("pt-BR")} ({dias} {dias === 1 ? "dia" : "dias"}).
          </p>
          <a href="/assinar" onClick={aoClicar("/assinar")} className="mt-3 inline-block text-sm font-semibold text-marca">Renovar</a>
        </div>
      ) : (
        <ChamadaAssinatura />
      )}
    </div>
  );
}

function CartaoFundador({ leitor }: { leitor: Leitor }) {
  const f = leitor.fundador!;
  const [nome, setNome] = useState(f.nome_mural ?? leitor.nome);
  const [mostrar, setMostrar] = useState(f.mostrar_mural);
  const [salvo, setSalvo] = useState(false);

  async function salvar(dados: { nome_mural?: string; mostrar_mural?: boolean }) {
    await supabase.from("fundadores").update(dados).eq("id", f.id);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <div className="cartao p-6 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-suave">Clube de Fundadores</p>
          <p className="text-3xl font-bold">{numeroFundador(f.numero)}</p>
          <div className="mt-1"><SeloFundador numero={f.numero} /></div>
        </div>
        <div className="flex gap-2">
          <a href="/fundadores/certificado" onClick={aoClicar("/fundadores/certificado")} className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white">Certificado</a>
          <a href="/fundadores/votacao" onClick={aoClicar("/fundadores/votacao")} className="rounded-full border border-borda px-4 py-2 text-sm font-semibold hover:bg-painel-2">Votar nas pautas</a>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-suave">Nome no Mural dos Fundadores {salvo && <span className="text-emerald-500">· salvo</span>}</span>
          <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} onBlur={() => salvar({ nome_mural: nome })} className="w-full rounded-lg border border-borda bg-fundo px-3 py-2.5" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mostrar} onChange={(e) => { setMostrar(e.target.checked); salvar({ mostrar_mural: e.target.checked }); }} className="size-4 accent-marca" />
          Aparecer no mural
        </label>
      </div>
    </div>
  );
}
