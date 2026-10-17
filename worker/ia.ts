import Anthropic from "@anthropic-ai/sdk";
import type { Bindings, Tendencia } from "./env";

export const CATEGORIAS = [
  "noticias", "urgente", "mundo", "esportes", "famosos", "curiosidades", "viral", "emocionante",
  "humor", "animais", "natureza", "ciencia", "tecnologia", "saude", "economia", "policia",
] as const;

const SISTEMA = `Você é o editor-chefe da página de Facebook "Planeta Diário", que publica Reels sobre tudo o que está bombando no mundo para o público brasileiro.
Para cada item (assunto em alta ou vídeo viral) você decide:
- titulo_pt: título curto em português do Brasil, claro e chamativo (sem clickbait enganoso).
- resumo: 1 frase explicando o que é, em português.
- categoria: uma das categorias permitidas. Use "urgente" só para fatos graves e de última hora; "mundo" para fatos internacionais sem categoria mais específica; "noticias" para fatos do Brasil.
- score (0 a 100): potencial de viralizar como Reel no Facebook Brasil AGORA. Pese: emoção/surpresa, interesse amplo do brasileiro, imagem forte, frescor, volume de busca/visualização. Dê bônus quando é algo de fora que ainda não chegou ao Brasil (chance de exclusividade). Penalize: assunto de nicho local estrangeiro sem apelo, conteúdo longo (filmes, novelas, episódios, lives), propaganda, política partidária polêmica, conteúdo sensível demais (morte explícita, menores em risco).
- busca: termo curto (em inglês se for assunto internacional) para encontrar vídeos sobre o assunto.
Responda sobre todos os itens, mantendo o mesmo "id".`;

const ESQUEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          titulo_pt: { type: "string" },
          resumo: { type: "string" },
          categoria: { type: "string", enum: [...CATEGORIAS] },
          score: { type: "integer" },
          busca: { type: "string" },
        },
        required: ["id", "titulo_pt", "resumo", "categoria", "score", "busca"],
        additionalProperties: false,
      },
    },
  },
  required: ["itens"],
  additionalProperties: false,
} as const;

export interface Analise {
  id: string;
  titulo_pt: string;
  resumo: string;
  categoria: (typeof CATEGORIAS)[number];
  score: number;
  busca: string;
}

/** Classifica e pontua um lote de tendências com o Claude */
export async function analisarTendencias(env: Bindings, lote: Tendencia[], aprendizados = ""): Promise<Analise[]> {
  const sistema = aprendizados ? `${SISTEMA}${String.fromCharCode(10, 10)}Aprendizados do desempenho recente da página (use para pontuar):${String.fromCharCode(10)}${aprendizados}` : SISTEMA;
  if (!lote.length) return [];
  const entrada = lote.map((t) => ({
    id: t.id,
    fonte: t.fonte,
    pais: t.pais,
    titulo: t.titulo,
    trafego: t.trafego,
    manchetes: Array.isArray(t.noticias)
      ? (t.noticias as { titulo?: string }[]).slice(0, 3).map((n) => n.titulo)
      : undefined,
    duracao_seg: t.extra?.duracao,
  }));

  if (!env.IA_MODELO.startsWith("claude")) {
    const { itens } = await nvidiaJson<{ itens: Analise[] }>(env, sistema, JSON.stringify(entrada), ESQUEMA);
    return normalizar(itens);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const resposta = await client.beta.messages.create({
    model: env.IA_MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system: sistema,
    messages: [{ role: "user", content: JSON.stringify(entrada) }],
  });

  if (resposta.stop_reason === "refusal") throw new Error("Claude recusou a análise do lote");
  const texto = resposta.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") throw new Error("Resposta do Claude sem texto");
  const { itens } = JSON.parse(texto.text) as { itens: Analise[] };
  return normalizar(itens);
}

function normalizar(itens: Analise[]): Analise[] {
  return itens
    .filter((i) => (CATEGORIAS as readonly string[]).includes(i.categoria))
    .map((i) => ({ ...i, score: Math.max(0, Math.min(100, Math.round(Number(i.score) || 0))) }));
}

/** Reserva: se a NVIDIA desativar o modelo principal (aconteceu com o Kimi K3), usa o próximo sem parar o sistema */
const RESERVA_NVIDIA = ["nvidia/nemotron-3.5-super-vl-120b-a12b", "nvidia/nemotron-3-super-120b-a12b", "z-ai/glm-5.3"];

/** Modelos abertos via NVIDIA (API compatível com OpenAI) */
export async function nvidiaJson<T>(env: Bindings, sistema: string, usuario: string, esquema: object): Promise<T> {
  const modelos = [...new Set([env.IA_MODELO, ...RESERVA_NVIDIA])];
  let ultimoErro: Error | null = null;
  for (const modelo of modelos) {
    try {
      return await nvidiaJsonModelo<T>(env, modelo, sistema, usuario, esquema);
    } catch (e) {
      ultimoErro = e as Error;
      // só troca de modelo se este deixou de existir; limite (429) e instabilidade voltam para quem chamou tentar de novo
      if (!/HTTP (404|410|500)/.test(ultimoErro.message)) throw e;
      console.log(`modelo ${modelo} indisponível, usando o próximo`);
    }
  }
  throw ultimoErro ?? new Error("NVIDIA: nenhum modelo disponível");
}

async function nvidiaJsonModelo<T>(env: Bindings, modelo: string, sistema: string, usuario: string, esquema: object): Promise<T> {
  const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 16000,
      temperature: 0.3,
      messages: [
        { role: "system", content: `${sistema}

Responda APENAS com JSON válido neste esquema:
${JSON.stringify(esquema)}` },
        { role: "user", content: usuario },
      ],
    }),
  });
  if (!r.ok) throw new Error(`NVIDIA: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as { choices: { message: { content: string } }[] };
  return primeiroJson(d.choices[0]?.message.content ?? "") as T;
}

/** Lê o primeiro objeto JSON da resposta, mesmo com texto antes ou depois (o Nemotron às vezes comenta no fim) */
export function primeiroJson(texto: string): unknown {
  for (let ini = texto.indexOf("{"); ini >= 0; ini = texto.indexOf("{", ini + 1)) {
    let nivel = 0;
    let emTexto = false;
    for (let i = ini; i < texto.length; i++) {
      const c = texto[i];
      if (emTexto) {
        if (c === "\\") i++;
        else if (c === '"') emTexto = false;
      } else if (c === '"') emTexto = true;
      else if (c === "{") nivel++;
      else if (c === "}" && --nivel === 0) {
        try {
          return JSON.parse(texto.slice(ini, i + 1));
        } catch {
          break; // não era JSON válido: tenta a partir da próxima chave
        }
      }
    }
  }
  throw new Error("NVIDIA: resposta sem JSON");
}
