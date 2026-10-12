import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { api } from "../api";
import Icone from "../Icone";

interface Situacao {
  conectada: boolean;
  ligada: boolean;
  conta: string | null;
  posts: number;
  app_configurado: boolean;
}
interface Dados {
  redes: Record<string, Situacao>;
  youtube_max_dia: number;
}

const INFO: Record<string, { nome: string; descricao: string; oauth: boolean }> = {
  telegram: { nome: "Telegram", descricao: "Canal com o vídeo, a manchete e o link da notícia no site.", oauth: false },
  threads: { nome: "Threads", descricao: "Post com vídeo e link do site. Conta do Instagram @planetadiario.news.", oauth: true },
  youtube: { nome: "YouTube Shorts", descricao: "Os melhores do dia (limite da cota da API). Vídeos de emissoras de TV ficam de fora.", oauth: true },
  tiktok: { nome: "TikTok", descricao: "Até a auditoria do TikTok aprovar o app, os vídeos ficam privados.", oauth: true },
};

/** Ajustes → Redes: conectar contas e ligar/desligar cada rede */
export default function Redes() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = () => api<Dados>("/redes").then(setD).catch((e) => setErro(e.message));
  useEffect(() => {
    carregar();
    const p = new URLSearchParams(location.search);
    if (p.get("rede")) {
      setAviso(`${INFO[p.get("rede")!]?.nome ?? p.get("rede")}: ${p.get("resultado")}`);
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  async function conectar(rede: string) {
    try {
      const { url } = await api<{ url: string }>(`/redes/${rede}/conectar`, { method: "POST" });
      location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function ligar(rede: string, ligada: boolean) {
    const { data } = await supabase.from("config").select("valor").eq("chave", "redes").maybeSingle();
    await supabase.from("config").upsert({ chave: "redes", valor: { ...(data?.valor ?? {}), [rede]: ligada } });
    carregar();
  }

  if (erro) return <p className="cartao p-4 text-sm text-red-500">{erro}</p>;
  if (!d) return <div className="cartao h-40 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      {aviso && <p className="cartao p-3 text-sm">{aviso}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(INFO).map(([rede, info]) => {
          const s = d.redes[rede];
          return (
            <section key={rede} className="cartao flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{info.nome}</h3>
                  <p className="text-sm text-suave">{info.descricao}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s?.conectada ? "bg-emerald-500/15 text-emerald-500" : "bg-painel-2 text-suave"}`}>
                  {s?.conectada ? "Conectada" : "Desconectada"}
                </span>
              </div>
              <p className="text-sm text-suave">
                {s?.conta ? <>Conta: <b className="text-texto">{s.conta}</b> · </> : null}
                {s?.posts ?? 0} posts
              </p>
              {!s?.app_configurado && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">Falta configurar as credenciais do app no servidor.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                {info.oauth && s?.app_configurado && (
                  <button onClick={() => conectar(rede)} className="flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white">
                    <Icone nome="link" className="size-4" /> {s.conectada ? "Reconectar" : "Conectar conta"}
                  </button>
                )}
                {s?.conectada && (
                  <button onClick={() => ligar(rede, !s.ligada)} className="rounded-lg border border-borda px-3 py-1.5 text-sm hover:bg-painel-2">
                    {s.ligada ? "Pausar postagens" : "Retomar postagens"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
