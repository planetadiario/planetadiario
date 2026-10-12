import Anthropic from "@anthropic-ai/sdk";
import type { Bindings } from "./env";
import { supa } from "./coleta";
import { nvidiaJson } from "./ia";

type Metricas = Record<string, number | string | undefined>;

const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** Visualizações quando disponíveis; senão, engajamento ponderado */
export function desempenho(m: Metricas | null) {
  if (!m) return 0;
  const views = num(m.fb_views) + num(m.ig_views);
  const engaj =
    num(m.fb_curtidas) + num(m.ig_curtidas) + 2 * (num(m.fb_comentarios) + num(m.ig_comentarios)) + 3 * (num(m.fb_compartilhamentos) + num(m.ig_compartilhamentos)) + 2 * num(m.ig_salvos);
  return views > 0 ? views + engaj * 10 : engaj;
}

const SISTEMA = `Você é o analista de desempenho da página "Planeta Diário" (Reels de notícias no Facebook e Instagram, público brasileiro).
Você recebe os Reels que MAIS se destacaram e os que MENOS se destacaram, com manchete, categoria, horário e métricas.
Compare os dois grupos e tire aprendizados práticos para os próximos Reels: tipo de assunto, categoria, estilo da manchete (tamanho, palavras, tensão, números), primeira linha da legenda, duração, horário.
Regras:
- Cada aprendizado é uma instrução curta e acionável (ex.: "Manchetes com número e local concreto performam melhor").
- Baseie-se só nos dados; se a amostra for pequena, diga isso e seja cauteloso.
- Nunca sugira inventar fatos, exagerar ou enganar: a veracidade vem antes do engajamento.`;

const ESQUEMA = {
  type: "object",
  properties: {
    aprendizados: { type: "array", items: { type: "string" } },
    categorias_fortes: { type: "array", items: { type: "string" } },
    categorias_fracas: { type: "array", items: { type: "string" } },
  },
  required: ["aprendizados", "categorias_fortes", "categorias_fracas"],
  additionalProperties: false,
} as const;

interface Resultado {
  aprendizados: string[];
  categorias_fortes: string[];
  categorias_fracas: string[];
}

/** Compara os melhores e piores Reels e grava os aprendizados usados pela IA */
export async function gerarAprendizados(env: Bindings) {
  const db = supa(env);
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db
    .from("reels")
    .select("manchete, categoria, legenda, duracao, publicado_em, metricas")
    .eq("status", "publicado")
    .gte("publicado_em", desde)
    .not("metricas", "is", null);

  const reels = (data ?? []).map((r) => ({ ...r, nota: desempenho(r.metricas as Metricas) }));
  if (reels.length < 6) return { ok: false, motivo: `Poucos Reels com métricas (${reels.length}); são necessários pelo menos 6.` };

  reels.sort((a, b) => b.nota - a.nota);
  const n = Math.min(5, Math.floor(reels.length / 2));
  const resumo = (r: (typeof reels)[number]) => ({
    manchete: r.manchete,
    categoria: r.categoria,
    primeira_linha_legenda: (r.legenda ?? "").split(String.fromCharCode(10))[0],
    duracao_seg: r.duracao,
    publicado_brasilia: new Date(r.publicado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit" }),
    metricas: r.metricas,
  });
  const entrada = JSON.stringify({ total_analisado: reels.length, destaques: reels.slice(0, n).map(resumo), fracos: reels.slice(-n).map(resumo) });

  let res: Resultado;
  if (env.IA_MODELO.startsWith("claude")) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: env.IA_MODELO,
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{ role: "user", content: entrada }],
    });
    const t = r.content.find((b) => b.type === "text");
    if (!t || t.type !== "text") throw new Error("IA sem resposta");
    res = JSON.parse(t.text) as Resultado;
  } else {
    res = await nvidiaJson<Resultado>(env, SISTEMA, entrada, ESQUEMA);
  }

  const texto = [
    ...res.aprendizados.slice(0, 8).map((a) => `- ${a}`),
    res.categorias_fortes.length ? `- Categorias com melhor desempenho: ${res.categorias_fortes.join(", ")}` : "",
    res.categorias_fracas.length ? `- Categorias com pior desempenho: ${res.categorias_fracas.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(String.fromCharCode(10));

  const valor = { texto, ...res, base: reels.length, atualizado_em: new Date().toISOString() };
  await db.from("config").upsert({ chave: "aprendizados", valor });
  return { ok: true, ...valor };
}
