import { useEffect, useState } from "react";
import Icone from "../Icone";
import { supabase } from "../supabase";
import { aoClicar, entrarComGoogle, nomeCategoria, paragrafosSite, quando, type Leitor, type Noticia } from "./base";
import { Avatar, LogoGoogle, SeloAssinante } from "./Site";
import { ChamadaAssinatura, Selos } from "./Inicio";
import { SeloFundador } from "./Fundadores";
import Anuncio from "./Anuncio";
import { Compartilhar, SigaRedes } from "./Redes";

export default function PaginaNoticia({ slug, leitor }: { slug: string; leitor: Leitor | null | undefined }) {
  const [n, setN] = useState<Noticia | null | undefined>(undefined);

  useEffect(() => {
    if (leitor === undefined) return;
    supabase.rpc("ler_noticia", { p_slug: slug }).then(({ data }) => {
      const item = (data as Noticia[] | null)?.[0] ?? null;
      setN(item);
      if (item) document.title = `${item.manchete} | Planeta Diário`;
    });
  }, [slug, leitor]);

  if (n === undefined) return <div className="h-96 animate-pulse rounded-2xl bg-painel-2" />;
  if (n === null)
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Notícia não encontrada</p>
        <p className="mt-1 text-sm text-suave">Ela pode estar disponível só para assinantes por enquanto.</p>
        <a href="/" onClick={aoClicar("/")} className="mt-4 inline-block text-marca">Voltar para a capa</a>
      </div>
    );

  const url = `${window.location.origin}/n/${n.slug}`;
  const paragrafos = paragrafosSite(n.artigo ?? n.legenda ?? "");

  return (
    <article className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)]">
      <div className="md:sticky md:top-32 md:self-start">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl bg-black">
          {n.video_url ? (
            <video src={n.video_url} poster={n.thumb_url ?? undefined} controls playsInline autoPlay muted className="h-full w-full" />
          ) : (
            <>
              {n.thumb_url && <img src={n.thumb_url} alt="" className="h-full w-full object-cover blur-md" />}
              <div className="absolute inset-0 grid place-items-center bg-black/50 p-6 text-center text-white">
                <div>
                  <p className="flex items-center justify-center gap-2 text-lg font-bold"><Icone nome="cadeado" /> Vídeo exclusivo</p>
                  <p className="mt-1 text-sm text-white/80">Disponível para assinantes Planeta Diário Pro.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <a href={`/c/${n.categoria}`} onClick={aoClicar(`/c/${n.categoria}`)} className="rounded bg-marca px-2 py-0.5 font-bold uppercase text-white">
            {nomeCategoria(n.categoria)}
          </a>
          <Selos n={n} />
          <span className="text-suave">{quando(n.site_publicado_em)} · {n.visualizacoes} leituras</span>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{n.manchete}</h1>

        {n.bloqueado ? (
          <div className="mt-6 max-w-md"><ChamadaAssinatura /></div>
        ) : (
          <div className="mt-6 flex max-w-2xl flex-col gap-4 text-[17px] leading-relaxed">
            {paragrafos.map((p, i) => <p key={i}>{p}</p>)}
            {n.origem_autor && <p className="text-sm text-suave">Vídeo: {n.origem_autor}</p>}
          </div>
        )}

        <Anuncio leitor={leitor} onde="artigo" />
        <Compartilhar url={url} titulo={n.manchete} />
        {!!n.hashtags?.length && (
          <p className="mt-4 flex flex-wrap gap-2 text-sm text-globo">{n.hashtags.map((h) => <span key={h}>#{h}</span>)}</p>
        )}

        <Comentarios noticiaId={n.id} leitor={leitor} />
        <SigaRedes titulo="Acompanhe o Planeta Diário nas redes" />
      </div>
    </article>
  );
}

interface Comentario {
  id: string;
  texto: string;
  criado_em: string;
  usuario_id: string;
  nome: string | null;
  avatar: string | null;
  assinante: boolean;
  fundador: number | null;
}

export function Comentarios({ noticiaId, leitor, compacto = false }: { noticiaId: string; leitor: Leitor | null | undefined; compacto?: boolean }) {
  const [lista, setLista] = useState<Comentario[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const carregar = () => supabase.rpc("comentarios_noticia", { p_noticia: noticiaId }).then(({ data }) => setLista(data ?? []));
    carregar();
    const canal = supabase
      .channel(`com-${noticiaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comentarios", filter: `noticia_id=eq.${noticiaId}` }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [noticiaId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!leitor || !texto.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from("comentarios").insert({ noticia_id: noticiaId, usuario_id: leitor.user.id, texto: texto.trim() });
    if (!error) setTexto("");
    setEnviando(false);
  }

  async function apagar(id: string) {
    await supabase.from("comentarios").delete().eq("id", id);
    setLista((l) => l.filter((c) => c.id !== id));
  }

  return (
    <section className={compacto ? "" : "mt-10 max-w-2xl border-t border-borda pt-6"}>
      <h2 className="mb-4 text-lg font-bold">Comentários ({lista.length})</h2>
      {leitor ? (
        <form onSubmit={enviar} className="mb-6 flex gap-3">
          <Avatar nome={leitor.nome} url={leitor.avatar} tamanho="size-9" />
          <div className="flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="O que você acha disso?"
              className="w-full rounded-xl border border-borda bg-painel p-3 text-sm outline-none focus:border-globo"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-suave">
              <span>+{leitor.assinante ? 10 : 5} pontos por comentário</span>
              <button disabled={enviando || !texto.trim()} className="rounded-full bg-marca px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Comentar
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button onClick={() => entrarComGoogle()} className="mb-6 flex items-center gap-2 rounded-full border border-borda bg-painel px-4 py-2 text-sm font-medium hover:bg-painel-2">
          <LogoGoogle /> Entre com o Google para comentar
        </button>
      )}
      <ul className="flex flex-col gap-5">
        {lista.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar nome={c.nome ?? "?"} url={c.avatar} tamanho="size-9" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm">
                <b>{c.nome ?? "Leitor"}</b>
                {c.fundador ? <SeloFundador numero={c.fundador} compacto /> : c.assinante && <SeloAssinante />}
                <span className="text-xs text-suave">{quando(c.criado_em)}</span>
                {leitor?.user.id === c.usuario_id && (
                  <button onClick={() => apagar(c.id)} className="ml-auto text-xs text-suave hover:text-red-500">apagar</button>
                )}
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words text-[15px]">{c.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
