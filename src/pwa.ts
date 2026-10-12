import { useEffect, useState } from "react";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendente: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pendente = e as EventoInstalar;
  ouvintes.forEach((f) => f());
});
window.addEventListener("appinstalled", () => {
  pendente = null;
  ouvintes.forEach((f) => f());
});

export function registrarSW() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const instalado = () => window.matchMedia("(display-mode: standalone)").matches;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Botão "Instalar app": usa o prompt nativo (Android/desktop) ou mostra a dica do iOS */
export function useInstalar() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((v) => v + 1);
    ouvintes.add(f);
    return () => void ouvintes.delete(f);
  }, []);
  if (instalado()) return null;
  if (pendente)
    return {
      tipo: "prompt" as const,
      instalar: async () => {
        await pendente?.prompt();
        pendente = null;
        ouvintes.forEach((f) => f());
      },
    };
  if (ios()) return { tipo: "ios" as const, instalar: async () => {} };
  return null;
}
