import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import Site from "./site/Site";

// /painel = administração; o resto é o site público
const painel = window.location.pathname.startsWith("/painel");

createRoot(document.getElementById("root")!).render(<StrictMode>{painel ? <App /> : <Site />}</StrictMode>);
