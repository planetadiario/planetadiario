import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bindings, Tendencia } from "./env";
import { buscarVideos, dailymotion, googleTrends, youtubeEmAlta } from "./coletores";
import { analisarTendencias } from "./ia";
import { dispararRender } from "./github";
import { metricasReel } from "./facebook";

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
}

export async function lerConfig(db: SupabaseClient): Promise<Config> {
  const { data, error } = await db.from("config").select("chave, valor");
  if (error) throw error;
  return Object.fromEntries(data.map((c) => [c.chave, c.valor])) as Config;
}

const CANAIS_DM = ["sport", "animals", "fun", "tech", "news", "lifestyle", "auto", "music"];
const MAX_DURACAO_AUTO = 180;

/** Roda a cada 10 minutos: coleta, analisa com IA e (se ligado) produz Reels sozinho */
export async function coletar(env: Bindings) {
  const db = supa(env);
  const cfg = await lerConfig(db);
  const log: string[] = [];

  // Brasil em toda rodada; os outros países em rodízio (limite de requisições do plano grátis)
  const rodada = Math.floor(Date.now() / 600_000);
  const outros = cfg.paises.filter((p) => p !== "BR");
  const paises = ["BR", ...new Set([outros[(rodada * 2) % outros.length], outros[(rodada * 2 + 1) % outros.length]])];
  const canal = CANAIS_DM[rodada % CANAIS_DM.length];

  const tarefas: Promise<Tendencia[]>[] = [];
  for (const p of paises) {
    tarefas.push(googleTrends(p), dailymotion(p, "news"), youtubeEmAlta(env, p));
  }
  tarefas.push(dailymotion("BR", canal), dailymotion("US", canal));

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

  await analisarPendentes(env, db, log);

  if (cfg.publicacao_automatica) await pilotoAutomatico(env, db, cfg, log);

  log.unshift(`coleta: ${novos.length} itens de ${paises.join(",")} (canal ${canal})`);
  console.log(log.join("\n"));
  return log;
}

async function analisarPendentes(env: Bindings, db: SupabaseClient, log: string[]) {
  const { data: pendentes, error } = await db
    .from("tendencias")
    .select("*")
    .eq("analisado", false)
    .gte("detectado_em", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("detectado_em", { ascending: false })
    .limit(80);
  if (error) return log.push(`pendentes: ${error.message}`);
  if (!pendentes?.length) return;

  try {
    // dois lotes em paralelo para acompanhar o volume da coleta
    const lotes = [pendentes.slice(0, 40), pendentes.slice(40)];
    const analises = (await Promise.all(lotes.map((l) => analisarTendencias(env, l)))).flat();
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
  if ((count ?? 0) >= cfg.max_posts_dia) return log.push("piloto: limite diário atingido");

  // reels em produção seguram a fila (evita publicar vários de uma vez)
  const { count: emProducao } = await db
    .from("reels")
    .select("id", { count: "exact", head: true })
    .in("status", ["na_fila", "processando", "publicando"]);
  if ((emProducao ?? 0) > 0) return;

  const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: candidatos } = await db
    .from("tendencias")
    .select("*")
    .eq("usado", false)
    .eq("analisado", true)
    .gte("score", cfg.score_minimo_auto)
    .gte("detectado_em", desde)
    .order("score", { ascending: false })
    .limit(5);

  for (const t of candidatos ?? []) {
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
    await dispararRender(env, reel.id, true);
    return log.push(`piloto: reel ${reel.id} (${t.titulo_pt ?? t.titulo})`);
  }
}

/** Roda de hora em hora: atualiza curtidas/comentários dos Reels dos últimos 30 dias */
export async function atualizarMetricas(env: Bindings) {
  const db = supa(env);
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db
    .from("reels")
    .select("id, fb_video_id, ig_media_id")
    .eq("status", "publicado")
    .gte("publicado_em", desde)
    .order("metricas_em", { ascending: true, nullsFirst: true })
    .limit(20);
  for (const r of data ?? []) {
    try {
      const metricas = await metricasReel(env, r.fb_video_id, r.ig_media_id);
      await db.from("reels").update({ metricas, metricas_em: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      console.log(`métricas ${r.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
