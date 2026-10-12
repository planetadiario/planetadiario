import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bindings, Tendencia } from "./env";
import { buscarVideos, dailymotion, googleTrends, youtubeEmAlta } from "./coletores";
import { bluesky, noticiasPais, telegram } from "./fontes-extras";
import { analisarTendencias } from "./ia";
import { dispararRender } from "./github";
import { metricasReel, seguidores } from "./facebook";

export function supa(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Config {
  publicacao_automatica: boolean;
  score_minimo_auto: number;
  max_posts_dia: number;
  paises: string[];
  fontes_bloqueadas: string[];
  aprendizados?: { texto?: string };
  telegram_canais?: string[];
  intervalo_min_minutos?: number;
  horarios_pico?: [number, number][];
  meta_posts_dia?: number;
  urgente_automatico?: boolean;
}

export const CANAIS_TELEGRAM_PADRAO = [
  "Breaking911", "bnonews", "disclosetv", "insiderpaper", "wfwitness", "ClashReport", "WarMonitors",
  "metropoles", "cnnbrasil", "g1noticias",
];

export async function lerConfig(db: SupabaseClient): Promise<Config> {
  const { data, error } = await db.from("config").select("chave, valor");
  if (error) throw error;
  return Object.fromEntries(data.map((c) => [c.chave, c.valor])) as Config;
}

const CANAIS_DM = ["sport", "animals", "fun", "tech", "news", "lifestyle", "auto", "music"];
const MAX_DURACAO_AUTO = 180;

/**
 * Roda a cada 5 minutos, alternando dois grupos de fontes (limite de 50 requisições
 * por execução no plano grátis):
 *  - rodada par:   Google Trends + YouTube em alta + Dailymotion (3 países em rodízio)
 *  - rodada ímpar: Telegram (canais de última hora) + Google Notícias + Bluesky
 * Depois analisa com IA e (se ligado) produz Reels sozinho.
 */
export async function coletar(env: Bindings, forcarGrupo?: "par" | "impar") {
  const db = supa(env);
  const cfg = await lerConfig(db);
  const log: string[] = [];

  // destrava publicações interrompidas (ficam "publicando" se a execução cair no meio)
  await db
    .from("reels")
    .update({ status: "pronto", erro: "A publicação foi interrompida. Clique em Publicar de novo." })
    .eq("status", "publicando")
    .lt("atualizado_em", new Date(Date.now() - 10 * 60_000).toISOString());

  // Brasil em toda rodada; os outros países em rodízio
  const rodada = Math.floor(Date.now() / 300_000);
  const meia = Math.floor(rodada / 2);
  const outros = cfg.paises.filter((p) => p !== "BR");
  const paises = ["BR", ...new Set([outros[(meia * 2) % outros.length], outros[(meia * 2 + 1) % outros.length]])];
  const canal = CANAIS_DM[meia % CANAIS_DM.length];

  const tarefas: Promise<Tendencia[]>[] = [];
  let grupo: string;
  if (forcarGrupo ? forcarGrupo === "par" : rodada % 2 === 0) {
    grupo = `trends/youtube/dailymotion ${paises.join(",")} (${canal})`;
    for (const p of paises) tarefas.push(googleTrends(p), dailymotion(p, "news"), youtubeEmAlta(env, p));
    tarefas.push(dailymotion("BR", canal), dailymotion("US", canal));
  } else {
    // 5 canais do Telegram por rodada, em rodízio
    const canais = cfg.telegram_canais?.length ? cfg.telegram_canais : CANAIS_TELEGRAM_PADRAO;
    const escolhidos = Array.from({ length: Math.min(5, canais.length) }, (_, i) => canais[(meia * 5 + i) % canais.length]);
    grupo = `telegram ${[...new Set(escolhidos)].join(",")} + notícias ${paises.join(",")} + bluesky`;
    for (const c of new Set(escolhidos)) tarefas.push(telegram(c));
    // GDELT aceita 1 pedido a cada 5 s: países em fila
    tarefas.push(
      (async () => {
        const todas: Tendencia[] = [];
        for (const [i, p] of paises.entries()) {
          if (i) await new Promise((r) => setTimeout(r, 5500));
          todas.push(...(await noticiasPais(p).catch(() => [])));
        }
        return todas;
      })(),
    );
    tarefas.push(bluesky(env.BLUESKY_USUARIO, env.BLUESKY_SENHA_APP));
  }

  const resultados = await Promise.allSettled(tarefas);
  const bloqueadas = cfg.fontes_bloqueadas.map((f) => f.toLowerCase());
  const vistos = new Set<string>();
  const novos: Tendencia[] = [];
  for (const r of resultados) {
    if (r.status === "rejected") {
      log.push(String(r.reason));
      continue;
    }
    for (const t of r.value) {
      const k = `${t.fonte}|${t.chave}`;
      const autor = String(t.extra?.autor ?? "").toLowerCase();
      if (vistos.has(k) || bloqueadas.some((b) => autor.includes(b))) continue;
      vistos.add(k);
      novos.push(t);
    }
  }

  if (novos.length) {
    const { error } = await db
      .from("tendencias")
      .upsert(novos, { onConflict: "fonte,chave", defaultToNull: false });
    if (error) log.push(`upsert: ${error.message}`);
  }

  await analisarPendentes(env, db, log, cfg.aprendizados?.texto ?? "");

  // assuntos quentes sem vídeo: procura um vídeo e já deixa pronto no Radar
  // (busca no YouTube custa 100 de cota; só em 1 a cada 4 rodadas para caber nos 10 mil/dia)
  await buscarVideosQuentes(env, db, log, rodada % 4 === 0);

  if (cfg.publicacao_automatica) await pilotoAutomatico(env, db, cfg, log);

  log.unshift(`coleta: ${novos.length} itens — ${grupo}`);
  console.log(log.join("\n"));
  return log;
}

/**
 * Pré-nota por sinais objetivos (sem IA): decide o que a IA analisa primeiro.
 * Assim os itens mais promissores sempre recebem nota, mesmo com o limite do plano grátis.
 */
/** Popularidade real (0–100) pelo volume de cada fonte: buscas, views, curtidas */
export function popularidade(t: Tendencia): number {
  const v = Number(t.trafego ?? 0);
  const escala = (x: number, max: number) => Math.min(100, (Math.log10(Math.max(1, x)) / Math.log10(max)) * 100);
  switch (t.fonte) {
    case "google_trends": return escala(v, 200_000); // 1,8 mil buscas ≈ 61
    case "youtube": return escala(v, 5_000_000);
    case "dailymotion": return escala(v, 20_000); // views na última hora
    case "bluesky": return escala(v, 20_000); // curtidas
    case "telegram": return 60; // canais de última hora (sem contador público)
    default: return 45;
  }
}

/** Nota final para publicar: 60% qualidade/viralização da IA + 40% popularidade real */
export function notaFinal(t: Tendencia): number {
  return Math.round(0.6 * Number(t.score ?? 0) + 0.4 * popularidade(t));
}

export function preNota(t: Tendencia): number {
  const idadeMin = (Date.now() - Date.parse(String(t.extra?.publicado ?? t.detectado_em ?? Date.now()))) / 60_000;
  const frescor = Number.isFinite(idadeMin) ? Math.max(0, 1 - idadeMin / 360) : 0.5; // perde valor em 6 h
  const v = Number(t.trafego ?? 0);
  let base: number;
  switch (t.fonte) {
    case "telegram": base = 70; break; // canais de última hora
    case "bluesky": base = 40 + Math.min(40, v / 50); break; // curtidas
    case "google_trends": base = 20 + Math.min(60, Math.log10(Math.max(1, v)) * 12); break; // volume de buscas
    case "dailymotion": base = 15 + Math.min(55, v / 20); break; // views na última hora
    case "youtube": base = 20 + Math.min(50, Math.log10(Math.max(1, v)) * 8); break; // views
    default: base = 35;
  }
  const video = t.video_url ? 10 : 0;
  const curto = Number(t.extra?.duracao ?? 60) <= 180 ? 5 : -15;
  return base * (0.4 + 0.6 * frescor) + video + curto;
}

async function analisarPendentes(env: Bindings, db: SupabaseClient, log: string[], aprendizados: string) {
  const { data: candidatos, error } = await db
    .from("tendencias")
    .select("*")
    .eq("analisado", false)
    .gte("detectado_em", new Date(Date.now() - 4 * 3600_000).toISOString())
    .order("detectado_em", { ascending: false })
    .limit(400);
  if (error) return log.push(`pendentes: ${error.message}`);
  if (!candidatos?.length) return;

  // os 45 mais promissores pela pré-nota vão para a IA nesta rodada
  const pendentes = [...candidatos].sort((x, y) => preNota(y) - preNota(x)).slice(0, 45);

  try {
    // lotes de 15, um de cada vez; se a NVIDIA limitar, espera e tenta de novo
    const analises: Awaited<ReturnType<typeof analisarTendencias>> = [];
    for (let i = 0; i < pendentes.length; i += 15) {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        try {
          analises.push(...(await analisarTendencias(env, pendentes.slice(i, i + 15), aprendizados)));
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (tentativa === 2 || !/429|524|503|502/.test(msg)) {
            log.push(`analise lote ${i / 15 + 1}: ${msg.slice(0, 120)}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 4000 * (tentativa + 1)));
        }
      }
    }
    const porId = new Map(analises.map((a) => [a.id, a]));
    const atualizados = pendentes
      .filter((t) => porId.has(t.id))
      .map((t) => {
        const a = porId.get(t.id)!;
        return {
          ...t,
          titulo_pt: a.titulo_pt,
          resumo: a.resumo,
          categoria: a.categoria,
          score: a.score,
          extra: { ...(t.extra ?? {}), busca: a.busca },
          analisado: true,
        };
      });
    const { error: e2 } = await db.from("tendencias").upsert(atualizados, { onConflict: "id" });
    if (e2) log.push(`analise upsert: ${e2.message}`);
    else log.push(`analisados: ${atualizados.length}`);
  } catch (e) {
    log.push(`analise: ${e instanceof Error ? e.message : e}`);
  }
}

/** Cria um Reel sozinho a partir do melhor assunto ainda não usado */
async function pilotoAutomatico(env: Bindings, db: SupabaseClient, cfg: Config, log: string[]) {
  const inicioDia = new Date();
  inicioDia.setUTCHours(3, 0, 0, 0); // meia-noite em Brasília
  if (inicioDia > new Date()) inicioDia.setUTCDate(inicioDia.getUTCDate() - 1);

  const { count } = await db
    .from("reels")
    .select("id", { count: "exact", head: true })
    .gte("criado_em", inicioDia.toISOString())
    .not("status", "in", "(rejeitado,erro)");
  const feitosHoje = count ?? 0;

  const hora = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }));
  const janelas = cfg.horarios_pico?.length ? cfg.horarios_pico : [[7, 9], [11, 14], [17, 23]];

  // ritmo: se estiver atrás da meta do dia, aceita nota um pouco menor
  const minutosPico = janelas.reduce((s, [a, b]) => s + (b - a) * 60, 0);
  const minutosPassados = janelas.reduce((s, [a, b]) => s + Math.max(0, Math.min(hora, b) - a) * 60, 0);
  const esperado = Math.floor(((cfg.meta_posts_dia ?? 8) * minutosPassados) / Math.max(1, minutosPico));
  const atrasado = feitosHoje < esperado;
  const notaMinima = atrasado ? Math.max(45, cfg.score_minimo_auto - 5) : cfg.score_minimo_auto; // nota FINAL mínima

  // candidatos: nota da IA >= 50 (qualidade mínima); a ordem usa a nota final (IA + popularidade real)
  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: brutos } = await db
    .from("tendencias")
    .select("*")
    .eq("usado", false)
    .eq("analisado", true)
    .gte("score", 50)
    .gte("detectado_em", desde)
    .order("score", { ascending: false })
    .limit(80);
  const candidatos = (brutos ?? [])
    .map((t) => ({ ...t, nota_final: notaFinal(t) }))
    .filter((t) => t.nota_final >= notaMinima)
    .sort((a, b) => b.nota_final - a.nota_final)
    .slice(0, 5);
  if (!candidatos[0]) return;

  // publica na hora em que a notícia sai, a qualquer hora do dia: perder o momento é perder as visualizações
  if (feitosHoje >= cfg.max_posts_dia) return log.push("piloto: limite diário atingido");

  // até 2 Reels em produção ao mesmo tempo (a montagem leva ~4 min)
  const { count: emProducao } = await db
    .from("reels")
    .select("id", { count: "exact", head: true })
    .in("status", ["na_fila", "processando", "publicando"]);
  if ((emProducao ?? 0) >= 2) return;

  // intervalo mínimo entre publicações automáticas
  const intervalo = cfg.intervalo_min_minutos ?? 15;
  const { data: ultimo } = await db
    .from("reels")
    .select("publicado_em")
    .eq("status", "publicado")
    .order("publicado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo?.publicado_em && Date.now() - Date.parse(ultimo.publicado_em) < intervalo * 60_000) return;

  log.push(`piloto: melhor candidato ${candidatos[0].nota_final} — ${candidatos[0].titulo_pt ?? candidatos[0].titulo}`);

  for (const t of candidatos) {
    let videoUrl: string | null = t.video_url;
    let autor = t.extra?.autor ?? null;
    if (!videoUrl) {
      const busca = t.extra?.busca ?? t.titulo;
      const videos = (await buscarVideos(env, busca)).filter(
        (v) => ((v.extra?.duracao as number) ?? 999) <= MAX_DURACAO_AUTO,
      );
      videoUrl = videos[0]?.video_url ?? null;
      autor = videos[0]?.extra?.autor ?? null;
    }
    await db.from("tendencias").update({ usado: true }).eq("id", t.id);
    if (!videoUrl) continue;

    const { data: reel, error } = await db
      .from("reels")
      .insert({
        tendencia_id: t.id,
        origem_url: videoUrl,
        origem_autor: autor,
        origem_titulo: t.titulo,
        categoria: t.categoria ?? "noticias",
      })
      .select("id")
      .single();
    if (error) return log.push(`piloto: ${error.message}`);
    // URGENTE: publica sozinho se estiver ligado em Ajustes; senão espera aprovação (risco de informação falsa)
    await dispararRender(env, reel.id, t.categoria !== "urgente" || cfg.urgente_automatico === true);
    return log.push(`piloto: reel ${reel.id} (${t.titulo_pt ?? t.titulo})`);
  }
}

/** Roda de hora em hora: atualiza curtidas/comentários dos Reels dos últimos 30 dias */
export async function atualizarMetricas(env: Bindings) {
  const db = supa(env);
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db
    .from("reels")
    .select("id, fb_video_id, ig_media_id, metricas")
    .eq("status", "publicado")
    .gte("publicado_em", desde)
    .order("metricas_em", { ascending: true, nullsFirst: true })
    .limit(9); // ~5 chamadas por Reel; o plano grátis permite 50 por execução
  const log: string[] = [];
  // seguidores do dia (meta de monetização)
  try {
    const s = await seguidores(env);
    const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await db.from("seguidores_historico").upsert({ dia, fb: s.fb, ig: s.ig, atualizado_em: new Date().toISOString() });
    log.push(`seguidores: FB ${s.fb} · IG ${s.ig}`);
  } catch (e) {
    log.push(`seguidores: ${e instanceof Error ? e.message : e}`);
  }
  for (const r of data ?? []) {
    try {
      const metricas = await metricasReel(env, r.fb_video_id, r.ig_media_id, r.metricas);
      await db.from("reels").update({ metricas, metricas_em: new Date().toISOString() }).eq("id", r.id);
      log.push(`${r.id}: ${JSON.stringify(metricas)}`);
    } catch (e) {
      // marca como visto mesmo com erro, para não travar a fila dos outros Reels
      await db.from("reels").update({ metricas_em: new Date().toISOString() }).eq("id", r.id);
      log.push(`${r.id}: ERRO ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(log.join(String.fromCharCode(10)));
  return log;
}

async function buscarVideosQuentes(env: Bindings, db: SupabaseClient, log: string[], usarYoutube: boolean) {
  const { data } = await db
    .from("tendencias")
    .select("id, titulo, titulo_pt, score, extra")
    .eq("analisado", true)
    .is("video_url", null)
    .gte("score", 60)
    .gte("detectado_em", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("score", { ascending: false })
    .limit(10);
  const pendentes = (data ?? []).filter((t) => !t.extra?.buscado).slice(0, usarYoutube ? 2 : 3);
  for (const t of pendentes) {
    const busca = String(t.extra?.busca ?? t.titulo);
    const videos = (await buscarVideos(env, busca, usarYoutube)).filter((v) => Number(v.extra?.duracao ?? 0) <= 240);
    // YouTube primeiro (busca por relevância e vídeos curtos); depois Dailymotion
    const melhor = videos.find((v) => v.fonte === "youtube") ?? videos[0];
    await db
      .from("tendencias")
      .update({
        ...(melhor ? { video_url: melhor.video_url, imagem: melhor.imagem } : {}),
        extra: { ...(t.extra ?? {}), buscado: true, ...(melhor ? { autor: melhor.extra?.autor, video_titulo: melhor.titulo } : {}) },
      })
      .eq("id", t.id);
    log.push(`vídeo para "${(t.titulo_pt ?? t.titulo).slice(0, 50)}": ${melhor ? melhor.video_url : "nenhum"}`);
  }
}
