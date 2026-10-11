import type { Bindings } from "./env";

/** Cliente mínimo da API Lytex (fatura PIX). Docs: https://docs-pay.lytex.com.br/ */
const API = "https://api-pay.lytex.com.br";
let cache: { token: string; expira: number } | null = null;

async function token(env: Bindings): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;
  const r = await fetch(`${API}/v2/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: env.LYTEX_CLIENT_ID, clientSecret: env.LYTEX_CLIENT_SECRET }),
  });
  const d = (await r.json()) as { accessToken?: string; expireAt?: string; message?: string };
  if (!d.accessToken) throw new Error(`Lytex: ${d.message ?? `HTTP ${r.status}`}`);
  cache = { token: d.accessToken, expira: d.expireAt ? Date.parse(d.expireAt) : Date.now() + 3_500_000 };
  return cache.token;
}

async function chamar<T>(env: Bindings, metodo: string, caminho: string, corpo?: unknown, repetir = true): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${await token(env)}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401 && repetir) {
    cache = null;
    return chamar(env, metodo, caminho, corpo, false);
  }
  const d = (await r.json().catch(() => ({}))) as { message?: unknown; error?: unknown };
  if (!r.ok) throw new Error(`Lytex: ${JSON.stringify(d.message ?? d.error ?? `HTTP ${r.status}`)}`);
  return d as T;
}

export interface Fatura {
  _id: string;
  status: string;
  paymentMethods?: { pix?: { qrcode?: string; emv?: string } };
}

export async function criarPix(
  env: Bindings,
  valorCentavos: number,
  cliente: { nome: string; email: string; cpf: string; telefone: string },
  referencia: string,
) {
  const cpf = cliente.cpf.replace(/\D/g, "");
  if (cpf.length !== 11 && cpf.length !== 14) throw new Error("Informe um CPF válido");
  let tel = cliente.telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (tel.length < 10) tel = "11987654321";

  let fatura = await chamar<Fatura>(env, "POST", "/v2/invoices", {
    client: { type: cpf.length === 14 ? "pj" : "pf", name: cliente.nome || "Leitor", cpfCnpj: cpf, email: cliente.email, cellphone: tel },
    items: [{ name: "Assinatura Planeta Diário (30 dias)", quantity: 1, value: valorCentavos }],
    observation: "Assinatura Planeta Diário (30 dias)",
    dueDate: new Date(Date.now() + 30 * 60_000).toISOString().replace(/T.*/, "T23:59:59.000Z"),
    paymentMethods: { pix: { enable: true }, boleto: { enable: false }, creditCard: { enable: false } },
    referenceId: referencia.slice(0, 100),
  });
  let pix = fatura.paymentMethods?.pix?.qrcode ?? fatura.paymentMethods?.pix?.emv;
  if (!pix) {
    fatura = await consultarFatura(env, fatura._id);
    pix = fatura.paymentMethods?.pix?.qrcode ?? fatura.paymentMethods?.pix?.emv;
  }
  if (!pix) throw new Error("A Lytex não retornou o código PIX");
  return { id: fatura._id, pix };
}

export function consultarFatura(env: Bindings, id: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) throw new Error("fatura inválida");
  return chamar<Fatura>(env, "GET", `/v2/invoices/${id}`);
}
