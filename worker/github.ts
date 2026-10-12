import type { Bindings } from "./env";

/** Dispara o workflow que monta o vídeo no GitHub Actions */
export async function dispararRender(env: Bindings, reelId: string, autoPublicar = false) {
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/render.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "planetadiario-worker",
      },
      body: JSON.stringify({ ref: "main", inputs: { reel_id: reelId, auto_publicar: String(autoPublicar) } }),
    },
  );
  if (!r.ok) throw new Error(`GitHub dispatch: HTTP ${r.status} ${await r.text()}`);
}

/**
 * Roda uma rota interna demorada pelo GitHub Actions: o cron do Cloudflare (a cada 5–10 min)
 * só pode durar ~30 s, e a análise da IA e o Instagram levam minutos.
 */
export async function dispararTarefa(env: Bindings, rota: string) {
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/tarefas.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "planetadiario-worker",
      },
      body: JSON.stringify({ ref: "main", inputs: { rota } }),
    },
  );
  if (!r.ok) throw new Error(`GitHub dispatch: HTTP ${r.status} ${await r.text()}`);
}
