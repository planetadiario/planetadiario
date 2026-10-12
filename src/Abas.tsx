import Icone from "./Icone";

/** Barra de abas (sublinhado) usada nas páginas do painel */
export default function Abas<T extends string>({
  abas,
  atual,
  aoTrocar,
  extra,
}: {
  abas: { id: T; nome: string; icone?: string; contagem?: number }[];
  atual: T;
  aoTrocar: (id: T) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end gap-4 border-b border-borda">
      <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={atual === a.id}
            onClick={() => aoTrocar(a.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm transition ${
              atual === a.id ? "border-marca font-semibold text-texto" : "border-transparent text-suave hover:text-texto"
            }`}
          >
            {a.icone && <Icone nome={a.icone} className="size-4" />}
            {a.nome}
            {a.contagem != null && <span className="rounded-full bg-painel-2 px-1.5 text-[11px] tabular-nums">{a.contagem}</span>}
          </button>
        ))}
      </nav>
      {extra && <div className="mb-2 shrink-0">{extra}</div>}
    </div>
  );
}
