import { supabase } from "../supabase";

/** id aleatório do navegador (não identifica a pessoa; só conta visitantes únicos) */
function visitante() {
  try {
    let id = localStorage.getItem("pd-visitante");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pd-visitante", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** de onde a pessoa chegou (guardado na sessão: vale para todas as páginas que ela abrir) */
function origem() {
  try {
    const salva = sessionStorage.getItem("pd-origem");
    if (salva) return salva;
  } catch {
    /* sem storage */
  }
  const ua = navigator.userAgent;
  const utm = new URLSearchParams(location.search).get("utm_source");
  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname : "";
  } catch {
    /* referrer inválido */
  }
  const fonte = (utm ?? host).toLowerCase();
  const o =
    /instagram/.test(fonte) || /Instagram/.test(ua) ? "instagram"
    : /facebook|fb\.|fban|fbav/.test(fonte) || /FBAN|FBAV|FB_IAB/.test(ua) ? "facebook"
    : /threads/.test(fonte) || /Barcelona/.test(ua) ? "threads"
    : /t\.me|telegram/.test(fonte) || /Telegram/.test(ua) ? "telegram"
    : /youtube|youtu\.be/.test(fonte) ? "youtube"
    : /tiktok/.test(fonte) || /musical_ly|BytedanceWebview/.test(ua) ? "tiktok"
    : /whatsapp|wa\.me/.test(fonte) || /WhatsApp/.test(ua) ? "whatsapp"
    : /google/.test(fonte) ? "google"
    : /bing|yahoo|duckduckgo/.test(fonte) ? "busca"
    : /^x\.com$|twitter|t\.co/.test(fonte) ? "x"
    : fonte && !fonte.includes("planetadiario") ? "outro site"
    : "direto";
  try {
    sessionStorage.setItem("pd-origem", o);
  } catch {
    /* sem storage */
  }
  return o;
}

/** registra a visita da página atual (o banco ignora a mesma página repetida em 30 min) */
export function registrarVisita(caminho: string) {
  if (caminho.startsWith("/painel")) return;
  const dispositivo = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? "celular" : "computador";
  supabase
    .rpc("registrar_visita", { p_visitante: visitante(), p_caminho: caminho.slice(0, 300), p_origem: origem(), p_dispositivo: dispositivo })
    .then(() => {}, () => {});
}
