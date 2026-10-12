import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Leitor } from "./base";

interface Adsense {
  client: string;
  slot_home?: string;
  slot_artigo?: string;
}

let carregado: Promise<Adsense | null> | null = null;
const config = () =>
  (carregado ??= Promise.resolve(supabase.rpc("adsense_publico")).then(({ data }) => {
    const c = data as Adsense | null;
    return c?.client ? c : null;
  }));

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Espaço de anúncio do Google AdSense. Não aparece para assinantes Pro nem sem configuração. */
export default function Anuncio({ leitor, onde }: { leitor: Leitor | null | undefined; onde: "home" | "artigo" }) {
  const [cfg, setCfg] = useState<Adsense | null>(null);
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (leitor === undefined || leitor?.assinante) return;
    config().then(setCfg);
  }, [leitor]);

  const slot = cfg ? (onde === "home" ? cfg.slot_home : cfg.slot_artigo) : undefined;

  useEffect(() => {
    if (!cfg || !slot || !ref.current) return;
    if (!document.querySelector("script[data-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.dataset.adsense = "1";
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.client}`;
      document.head.appendChild(s);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* bloqueador de anúncios */
    }
  }, [cfg, slot]);

  if (!cfg || !slot || leitor?.assinante) return null;
  return (
    <div className="my-2">
      <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-suave">Publicidade</p>
      <ins ref={ref} className="adsbygoogle block" data-ad-client={cfg.client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
