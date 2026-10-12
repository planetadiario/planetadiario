import { aoClicar, entrarComGoogle, navegar, type Leitor } from "./base";
import { Avatar, LogoGoogle, SeloAssinante, sair } from "./Site";
import { ChamadaAssinatura } from "./Inicio";

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
