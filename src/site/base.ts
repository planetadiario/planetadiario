import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

// ---------- Rotas (sem dependências) ----------

export function navegar(caminho: string) {
  window.history.pushState({}, "", caminho);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

export function useCaminho() {
  const [caminho, setCaminho] = useState(window.location.pathname);
  useEffect(() => {
    const f = () => setCaminho(window.location.pathname);
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  return caminho;
}

/** <a> que navega sem recarregar a página */
export function aoClicar(caminho: string) {
  return (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.button !== 0) return;
    e.preventDefault();
    navegar(caminho);
  };
}

// ---------- Dados ----------

export interface Noticia {
  id: string;
  slug: string;
  categoria: string;
  manchete: string;
  legenda: string | null;
  artigo: string | null;
  hashtags: string[];
  video_url: string | null;
  thumb_url: string | null;
  origem_autor: string | null;
  exclusivo: boolean;
  bloqueado: boolean;
  antecipado: boolean;
  site_publicado_em: string;
  visualizacoes: number;
  comentarios?: number;
  fb_post_url?: string | null;
  ig_post_url?: string | null;
}

export const CATEGORIAS: { slug: string; label: string }[] = [
  { slug: "noticias", label: "Brasil" },
  { slug: "urgente", label: "Urgente" },
  { slug: "mundo", label: "Mundo" },
  { slug: "esportes", label: "Esportes" },
  { slug: "famosos", label: "Famosos" },
  { slug: "viral", label: "Viral" },
  { slug: "curiosidades", label: "Curiosidades" },
  { slug: "emocionante", label: "Emocionante" },
  { slug: "animais", label: "Animais" },
  { slug: "natureza", label: "Natureza" },
  { slug: "ciencia", label: "Ciência" },
  { slug: "tecnologia", label: "Tecnologia" },
  { slug: "saude", label: "Saúde" },
  { slug: "economia", label: "Economia" },
  { slug: "policia", label: "Polícia" },
  { slug: "humor", label: "Humor" },
];
export const nomeCategoria = (s: string) => CATEGORIAS.find((c) => c.slug === s)?.label ?? s;

export async function buscarNoticias(categoria?: string, antes?: string, limite = 24) {
  const { data, error } = await supabase.rpc("noticias_site", {
    p_categoria: categoria ?? null,
    p_limite: limite,
    p_antes: antes ?? null,
  });
  if (error) throw error;
  return (data ?? []) as Noticia[];
}

export function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ---------- Leitor logado ----------

export interface Leitor {
  user: User;
  nome: string;
  avatar: string | null;
  pontos: number;
  assinante: boolean;
  fimAssinatura: string | null;
}

export function useLeitor() {
  const [leitor, setLeitor] = useState<Leitor | null | undefined>(undefined);

  useEffect(() => {
    async function carregar(user: User | null | undefined) {
      if (!user) return setLeitor(null);
      const [perfil, ass] = await Promise.all([
        supabase.from("perfis").select("nome, avatar, pontos").eq("id", user.id).maybeSingle(),
        supabase.from("assinaturas").select("fim").eq("usuario_id", user.id).eq("status", "ativa").gt("fim", new Date().toISOString()).order("fim", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setLeitor({
        user,
        nome: perfil.data?.nome ?? user.user_metadata?.full_name ?? user.email ?? "Leitor",
        avatar: perfil.data?.avatar ?? user.user_metadata?.avatar_url ?? null,
        pontos: perfil.data?.pontos ?? 0,
        assinante: !!ass.data,
        fimAssinatura: ass.data?.fim ?? null,
      });
    }
    supabase.auth.getSession().then(({ data }) => carregar(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => carregar(s?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  return leitor;
}

export function entrarComGoogle() {
  return supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
}

export async function apiSite<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/api/site${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}`, ...init.headers },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
  return corpo as T;
}
