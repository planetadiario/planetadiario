import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import Site from "./site/Site";
import { registrarSW } from "./pwa";

// /painel = administração; o resto é o site público
const painel = window.location.pathname.startsWith("/painel");

// cada um é um app instalável separado (manifesto próprio)
if (painel) document.querySelector('link[rel="manifest"]')?.setAttribute("href", "/painel.webmanifest");
registrarSW();

createRoot(document.getElementById("root")!).render(<StrictMode>{painel ? <App /> : <Site />}</StrictMode>);
