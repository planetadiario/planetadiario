import { useEffect, useState } from "react";
import { api } from "../api";
import MonetizacaoRedes from "./MonetizacaoRedes";
import PlanoSemanal, { type MetasSemanais } from "./PlanoSemanal";

interface Dados {
  semana: MetasSemanais & { inicio: string };
  metas_semanais: MetasSemanais;
}

/** Plano da semana + monetização de cada rede */
export default function MetasMonetizacao() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api<Dados>("/monetizacao").then(setD).catch((e) => setErro(e.message));
  }, []);

  return (
    <>
      {erro ? (
        <p className="cartao p-4 text-sm text-red-500">Plano semanal: {erro}</p>
      ) : d ? (
        <PlanoSemanal semana={d.semana} metas={d.metas_semanais} />
      ) : (
        <div className="cartao h-44 animate-pulse" />
      )}
      <MonetizacaoRedes />
    </>
  );
}
