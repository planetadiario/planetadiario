import { useState } from "react";
import { supabase } from "../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado">("");
  const [erro, setErro] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setErro("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/painel`, shouldCreateUser: true },
    });
    if (error) {
      setErro(error.message);
      setEstado("");
    } else setEstado("enviado");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm cartao p-6">
        <img src="/logo-claro.png" alt="Planeta Diário" className="mx-auto mb-6 w-48 dark:hidden" />
        <img src="/logo.png" alt="Planeta Diário" className="mx-auto mb-6 hidden w-48 dark:block" />
        {estado === "enviado" ? (
          <p className="text-center text-sm text-suave">
            Enviamos um link de acesso para <b className="text-texto">{email}</b>. Abra o e-mail e clique no link.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-sm text-suave">E-mail do administrador</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-globo"
              placeholder="voce@email.com"
            />
            <button
              disabled={estado === "enviando"}
              className="w-full rounded-lg bg-marca py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {estado === "enviando" ? "Enviando…" : "Receber link de acesso"}
            </button>
            {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          </>
        )}
      </form>
    </div>
  );
}
