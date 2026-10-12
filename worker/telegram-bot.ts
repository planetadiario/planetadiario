import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bindings } from "./env";
import { supa } from "./coleta";
import { consultarFatura, cpfValido, criarPix } from "./lytex";

/**
 * Bot do Telegram (@PlanetaDiarioNews_bot): leva ao site, vende o Pro e o Clube de Fundadores por PIX
 * sem sair do Telegram e manda as notícias 30 min antes para quem é Pro no bot.
 */

export const BOT_USUARIO = "PlanetaDiarioNews_bot";

type Botao = { text: string; url?: string; callback_data?: string };

async function tg<T = unknown>(env: Bindings, metodo: string, corpo: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = (await r.json()) as { ok: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result as T;
}

const enviar = (env: Bindings, chat: number | string, texto: string, botoes?: Botao[][]) =>
  tg(env, "sendMessage", {
    chat_id: chat,
    text: texto,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(botoes ? { reply_markup: { inline_keyboard: botoes } } : {}),
  });

/** segredo do webhook derivado do INTERNAL_SECRET (o Telegram manda no cabeçalho) */
export async function segredoWebhook(env: Bindings) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram:${env.INTERNAL_SECRET}`));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

async function precos(db: SupabaseClient) {
  const { data } = await db.from("config").select("chave, valor").in("chave", ["assinatura_preco_centavos", "fundador_preco_centavos", "fundador_dias_pro"]);
  const c = Object.fromEntries((data ?? []).map((x) => [x.chave, Number(x.valor)]));
  return { pro: c.assinatura_preco_centavos || 990, fundador: c.fundador_preco_centavos || 1590, diasFundador: c.fundador_dias_pro ?? 30 };
}

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function menu(env: Bindings, p: { pro: number; fundador: number }): Botao[][] {
  return [
    [{ text: `⚡ Assinar Pro — ${reais(p.pro)}/mês`, callback_data: "comprar:pro" }],
    [{ text: `🏅 Clube de Fundadores — ${reais(p.fundador)}`, callback_data: "comprar:fundador" }],
    [
      { text: "📰 Abrir o site", url: env.SITE_URL },
      { text: "📢 Canal", url: "https://t.me/planetadiarionews" },
    ],
  ];
}

/** Trata cada atualização que o Telegram manda para o webhook */
export async function atualizacaoTelegram(env: Bindings, u: Record<string, any>) {
  const db = supa(env);
  const p = await precos(db);

  if (u.callback_query) {
    const q = u.callback_query;
    const chat = q.message?.chat?.id as number;
    await tg(env, "answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
    if (!chat) return;
    await registrar(db, q.from, chat);
    const [acao, valor] = String(q.data ?? "").split(":");
    if (acao === "comprar") return pedirCpf(env, db, chat, valor === "fundador" ? "fundador" : "pro", p);
    if (acao === "pago") return conferir(env, db, chat, valor);
    if (acao === "menu") return boasVindas(env, chat, p);
    return;
  }

  const m = u.message;
  if (!m?.chat || m.chat.type !== "private") return; // só conversa direta
  const chat = m.chat.id as number;
  const texto = String(m.text ?? "").trim();
  const usuario = await registrar(db, m.from, chat);

  if (texto.startsWith("/start")) {
    const param = texto.split(" ")[1];
    if (param === "pro" || param === "fundador") return pedirCpf(env, db, chat, param, p);
    return boasVindas(env, chat, p);
  }
  if (texto === "/pro") return pedirCpf(env, db, chat, "pro", p);
  if (texto === "/fundador") return pedirCpf(env, db, chat, "fundador", p);
  if (texto === "/site") return enviar(env, chat, `📰 Todas as notícias: ${env.SITE_URL}`);
  if (texto === "/status") return status(env, chat, usuario?.pro_ate ?? null);

  // esperando o CPF para gerar o PIX
  if (usuario?.estado?.startsWith("cpf:")) {
    const cpf = texto.replace(/\D/g, "");
    if (!cpfValido(cpf)) return enviar(env, chat, "Esse CPF não parece válido. Envie só os 11 números, por favor.");
    return gerarPix(env, db, chat, usuario.estado.slice(4) as "pro" | "fundador", cpf, m.from, p);
  }
  return boasVindas(env, chat, p);
}

async function registrar(db: SupabaseClient, de: Record<string, any> | undefined, chat: number) {
  const nome = [de?.first_name, de?.last_name].filter(Boolean).join(" ").slice(0, 80) || null;
  const { data } = await db
    .from("bot_usuarios")
    .upsert({ chat_id: chat, nome, username: de?.username ?? null, atualizado_em: new Date().toISOString() }, { onConflict: "chat_id" })
    .select("chat_id, estado, pro_ate")
    .single();
  return data as { chat_id: number; estado: string | null; pro_ate: string | null } | null;
}

function boasVindas(env: Bindings, chat: number, p: { pro: number; fundador: number }) {
  return enviar(
    env,
    chat,
    [
      "🌎 <b>Planeta Diário News</b>: o mundo em vídeos curtos.",
      "",
      `⚡ <b>Pro (${reais(p.pro)}/mês):</b> receba aqui as notícias <b>30 minutos antes</b> de todo mundo, site sem anúncios, selo e pontos em dobro.`,
      "",
      `🏅 <b>Clube de Fundadores (${reais(p.fundador)}, uma vez só):</b> número de fundador para sempre, selo, nome no mural, voto nas pautas e 30 dias de Pro de presente.`,
      "",
      "Pagamento por PIX aqui mesmo, sem sair do Telegram.",
    ].join("\n"),
    menu(env, p),
  );
}

function status(env: Bindings, chat: number, proAte: string | null) {
  const ativo = proAte && Date.parse(proAte) > Date.now();
  return enviar(
    env,
    chat,
    ativo
      ? `⚡ Seu Pro no bot vale até <b>${new Date(proAte!).toLocaleDateString("pt-BR")}</b>. Você recebe as notícias aqui antes de todo mundo.`
      : "Você ainda não é Pro. Toque em Assinar Pro para receber as notícias antes.",
    ativo ? undefined : [[{ text: "⚡ Assinar Pro", callback_data: "comprar:pro" }]],
  );
}

async function pedirCpf(env: Bindings, db: SupabaseClient, chat: number, tipo: "pro" | "fundador", p: { pro: number; fundador: number }) {
  await db.from("bot_usuarios").update({ estado: `cpf:${tipo}` }).eq("chat_id", chat);
  const item = tipo === "pro" ? `Pro por 30 dias — ${reais(p.pro)}` : `Clube de Fundadores — ${reais(p.fundador)} (pagamento único)`;
  return enviar(
    env,
    chat,
    `🧾 <b>${item}</b>\n\nPara gerar o PIX, envie seu <b>CPF</b> (só números). Ele é usado apenas pela nossa processadora de pagamentos (Lytex) para emitir a cobrança.\n\nAo continuar, você concorda com os <a href="${env.SITE_URL}/termos">Termos</a> e a <a href="${env.SITE_URL}/privacidade">Privacidade</a>.`,
  );
}

async function gerarPix(
  env: Bindings,
  db: SupabaseClient,
  chat: number,
  tipo: "pro" | "fundador",
  cpf: string,
  de: Record<string, any> | undefined,
  p: { pro: number; fundador: number },
) {
  const valor = tipo === "pro" ? p.pro : p.fundador;
  const { data: compra, error } = await db.from("bot_compras").insert({ chat_id: chat, tipo, valor_centavos: valor }).select("id").single();
  if (error) throw error;
  try {
    const pix = await criarPix(
      env,
      valor,
      { nome: [de?.first_name, de?.last_name].filter(Boolean).join(" ") || "Leitor", email: `telegram-${chat}@planetadiario.online`, cpf, telefone: "" },
      `PD-TG-${compra.id}`,
      tipo === "pro" ? "Planeta Diário Pro (30 dias) — Telegram" : "Fundador Planeta Diário (pagamento único) — Telegram",
    );
    await db.from("bot_compras").update({ fatura_id: pix.id }).eq("id", compra.id);
    await db.from("bot_usuarios").update({ estado: null }).eq("chat_id", chat);
    await tg(env, "sendPhoto", {
      chat_id: chat,
      photo: `https://quickchart.io/qr?size=500&margin=2&text=${encodeURIComponent(pix.pix)}`,
      caption: `PIX de ${reais(valor)} gerado. Escaneie o QR code ou use o código copia e cola abaixo.`,
    }).catch(() => {});
    await enviar(env, chat, `<code>${pix.pix}</code>\n\nToque no código para copiar. Assim que o pagamento cair, você recebe a confirmação aqui.`, [
      [{ text: "✅ Já paguei", callback_data: `pago:${compra.id}` }],
    ]);
  } catch (e) {
    await db.from("bot_compras").delete().eq("id", compra.id);
    await enviar(env, chat, `Não consegui gerar o PIX agora (${e instanceof Error ? e.message.replace(/^Lytex: /, "") : "erro"}). Tente de novo em instantes.`, [
      [{ text: "Tentar de novo", callback_data: `comprar:${tipo}` }],
    ]);
  }
}

async function conferir(env: Bindings, db: SupabaseClient, chat: number, compraId: string) {
  const { data: c } = await db.from("bot_compras").select("*").eq("id", compraId).eq("chat_id", chat).maybeSingle();
  if (!c?.fatura_id) return enviar(env, chat, "Não encontrei esse pedido.");
  if (c.status === "pago") return enviar(env, chat, `Esse pagamento já foi confirmado. Seu código: <code>${c.codigo}</code>`);
  const f = await consultarFatura(env, c.fatura_id);
  if (f.status?.toLowerCase() !== "paid") {
    return enviar(env, chat, "Ainda não recebemos a confirmação do PIX. Às vezes leva 1 ou 2 minutos.", [
      [{ text: "🔄 Conferir de novo", callback_data: `pago:${compraId}` }],
    ]);
  }
  await confirmarCompraBot(env, db, c.id);
}

/** Pagamento confirmado (pelo botão ou pelo webhook da Lytex): libera o Pro no bot e manda o código */
export async function confirmarCompraBot(env: Bindings, db: SupabaseClient, compraId: string) {
  const codigo = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
  const { data: c } = await db
    .from("bot_compras")
    .update({ status: "pago", pago_em: new Date().toISOString(), codigo })
    .eq("id", compraId)
    .eq("status", "pendente")
    .select("*")
    .maybeSingle();
  if (!c) return; // já confirmado antes
  const p = await precos(db);
  const { data: u } = await db.from("bot_usuarios").select("pro_ate").eq("chat_id", c.chat_id).single();
  const dias = c.tipo === "pro" ? 30 : p.diasFundador;
  const base = u?.pro_ate && Date.parse(u.pro_ate) > Date.now() ? Date.parse(u.pro_ate) : Date.now();
  const proAte = new Date(base + dias * 86400_000).toISOString();
  await db.from("bot_usuarios").update({ pro_ate: proAte }).eq("chat_id", c.chat_id);

  const ate = new Date(proAte).toLocaleDateString("pt-BR");
  const texto =
    c.tipo === "pro"
      ? `✅ <b>Pagamento confirmado!</b> Você é Pro até ${ate}.\n\n⚡ A partir de agora as notícias chegam aqui <b>30 minutos antes</b> de todo mundo.\n\n🔑 Para ativar o Pro também no site (sem anúncios, selo e pontos em dobro), entre em ${env.SITE_URL}/conta e use o código:\n<code>${codigo}</code>`
      : `🏅 <b>Bem-vindo ao Clube de Fundadores!</b>\n\nVocê ganhou ${dias} dias de Pro (até ${ate}): as notícias chegam aqui antes de todo mundo.\n\n🔑 Para receber seu <b>número de fundador</b>, o selo e entrar no mural, entre em ${env.SITE_URL}/conta com o Google e use o código:\n<code>${codigo}</code>`;
  await enviar(env, c.chat_id, texto, [[{ text: "🔑 Ativar no site", url: `${env.SITE_URL}/conta#assinatura` }]]);
}

/** Notícias novas vão primeiro para quem é Pro no bot (no acesso antecipado do site) */
export async function alertasAntecipados(env: Bindings) {
  if (!env.TELEGRAM_BOT_TOKEN) return { enviados: 0 };
  const db = supa(env);
  const { data: reels } = await db
    .from("reels")
    .select("id, manchete, slug")
    .eq("status", "publicado")
    .eq("bot_alertado", false)
    .not("slug", "is", null)
    .gte("site_publicado_em", new Date(Date.now() - 30 * 60_000).toISOString())
    .order("site_publicado_em", { ascending: true })
    .limit(2);
  if (!reels?.length) return { enviados: 0 };
  const { data: pros } = await db.from("bot_usuarios").select("chat_id").gt("pro_ate", new Date().toISOString()).limit(35);
  let enviados = 0;
  for (const r of reels) {
    await db.from("reels").update({ bot_alertado: true }).eq("id", r.id);
    for (const u of pros ?? []) {
      await enviar(env, u.chat_id, `⚡ <b>Antes de todo mundo</b>\n\n${r.manchete}\n\n${env.SITE_URL}/n/${r.slug}`)
        .then(() => enviados++)
        .catch(() => {});
    }
  }
  return { enviados };
}

/** Configura webhook, comandos e descrição do bot; fixa no canal a chamada para o bot */
export async function configurarBot(env: Bindings, fixarNoCanal = false) {
  await tg(env, "setWebhook", {
    url: `${env.SITE_URL}/api/telegram/webhook`,
    secret_token: await segredoWebhook(env),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await tg(env, "setMyCommands", {
    commands: [
      { command: "start", description: "Menu do Planeta Diário" },
      { command: "pro", description: "Assinar o Pro (notícias antes, por PIX)" },
      { command: "fundador", description: "Entrar no Clube de Fundadores" },
      { command: "status", description: "Ver meu plano" },
      { command: "site", description: "Abrir o site" },
    ],
  });
  await tg(env, "setMyShortDescription", { short_description: "O mundo em vídeos curtos. Notícias antes de todo mundo com o Pro. planetadiario.online" });
  await tg(env, "setMyDescription", {
    description:
      "🌎 Planeta Diário News: notícias do Brasil e do mundo em vídeos curtos.\n\n⚡ Assine o Pro por PIX aqui mesmo e receba as notícias 30 minutos antes de todo mundo.\n🏅 Entre no Clube de Fundadores.\n\n📰 planetadiario.online",
  });
  if (!fixarNoCanal) return { ok: true };
  const p = await precos(supa(env));
  const msg = await enviar(
    env,
    env.TELEGRAM_CANAL!,
    `🌎 <b>Bem-vindo ao Planeta Diário News!</b>\n\nAs notícias que estão bombando no mundo, em vídeos curtos, todos os dias.\n\n📰 Notícias completas: ${env.SITE_URL}\n⚡ Quer receber <b>antes de todo mundo</b>? Assine o Pro por ${reais(p.pro)}/mês no nosso bot, por PIX.\n🏅 Faça parte do <b>Clube de Fundadores</b> por ${reais(p.fundador)}, uma vez só.`,
    [
      [{ text: "⚡ Assinar o Pro", url: `https://t.me/${BOT_USUARIO}?start=pro` }],
      [{ text: "🏅 Clube de Fundadores", url: `https://t.me/${BOT_USUARIO}?start=fundador` }],
      [{ text: "📰 Abrir o site", url: env.SITE_URL }],
    ],
  ) as { message_id: number };
  await tg(env, "pinChatMessage", { chat_id: env.TELEGRAM_CANAL, message_id: msg.message_id, disable_notification: true });
  return { ok: true, fixada: msg.message_id };
}
