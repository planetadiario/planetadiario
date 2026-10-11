# Planeta Diário

Painel e automação de Reels da página **Planeta Diário** — https://planetadiario.online

## Como funciona

```
Cloudflare Worker (cron 10 min)
  ├─ coleta: Google Trends (12 países) · Dailymotion · YouTube em alta
  ├─ IA (Claude): traduz, classifica em 16 categorias e dá nota de viralização 0–100
  └─ piloto automático (opcional): escolhe o melhor assunto e dispara a montagem
        │
GitHub Actions (render.yml)
  ├─ yt-dlp baixa o vídeo
  ├─ Claude escreve manchete, legenda e hashtags
  ├─ ffmpeg monta 1080x1920 com o molde da categoria
  └─ envia para o Supabase Storage → status "pronto"
        │
Painel (React) → revisar / editar legenda → Publicar
  └─ Worker publica o Reel na página via API oficial do Facebook
```

| Pasta | O quê |
|---|---|
| `src/` | Painel (React + Tailwind) |
| `worker/` | API + coleta agendada (Hono no Cloudflare Workers) |
| `pipeline/` | Montagem dos vídeos (Python, roda no GitHub Actions) |
| `pipeline/assets/moldes/` | Um molde por categoria (gerados por `pipeline/scripts/gerar_moldes.py`) |
| `supabase/migrations/` | Banco de dados |

## Comandos

```bash
npm run dev       # painel local
npm run deploy    # build + publica no Cloudflare
python pipeline/scripts/gerar_moldes.py   # regenera os moldes após mudar categorias.json
```

## Segredos

**Cloudflare** (`npx wrangler secret put NOME`): `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_SECRET`,
`GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, `FB_PAGE_ID`, `FB_PAGE_TOKEN`, `YOUTUBE_API_KEY` (opcional).

**GitHub** (`gh secret set NOME`): `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_SECRET`, `ANTHROPIC_API_KEY`,
`YTDLP_COOKIES` (opcional, cookies.txt para sites que bloqueiam downloads).
