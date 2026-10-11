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
export async function analisarTendencias(env: Bindings, lote: Tendencia[]): Promise<Analise[]> {
  if (!lote.length) return [];
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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

  const resposta = await client.beta.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: "user", content: JSON.stringify(entrada) }],
  });

  if (resposta.stop_reason === "refusal") throw new Error("Claude recusou a análise do lote");
  const texto = resposta.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") throw new Error("Resposta do Claude sem texto");
  const { itens } = JSON.parse(texto.text) as { itens: Analise[] };
  return itens.map((i) => ({ ...i, score: Math.max(0, Math.min(100, Math.round(i.score))) }));
}
