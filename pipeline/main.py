"""Pipeline de um Reel: baixa → escreve textos → monta com o molde → envia → (publica).

Uso:
    python pipeline/main.py --reel <id> [--auto-publicar]
    python pipeline/main.py --limpar        # apaga vídeos antigos do storage
"""
import argparse
import os
import shutil
import sys
import tempfile
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import yt_dlp

from render import molde_padrao, montar
from texto import gerar_textos

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
CHAVE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HDR = {"apikey": CHAVE, "Authorization": f"Bearer {CHAVE}"}
BUCKET = "reels"


# ---------- Supabase ----------

def db_get(tabela: str, filtro: str, select: str = "*") -> list[dict]:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{tabela}?select={select}&{filtro}", headers=HDR, timeout=30)
    r.raise_for_status()
    return r.json()


def db_patch(tabela: str, filtro: str, dados: dict) -> None:
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{tabela}?{filtro}",
        headers={**HDR, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=dados, timeout=30,
    )
    r.raise_for_status()


def enviar_arquivo(caminho: str, arquivo: Path, tipo: str) -> str:
    with open(arquivo, "rb") as f:
        r = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{caminho}",
            headers={**HDR, "Content-Type": tipo, "x-upsert": "true", "cache-control": "3600"},
            data=f, timeout=600,
        )
    r.raise_for_status()
    # ?v= muda a cada montagem: navegador e CDN não reaproveitam a versão antiga
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{caminho}?v={int(time.time())}"


# ---------- Download ----------

def resolver_telegram(url: str) -> str:
    """t.me/canal/123 → endereço direto do .mp4 (página de incorporação do post)."""
    import re
    r = requests.get(url.split("?")[0] + "?embed=1&mode=tme", headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    r.raise_for_status()
    m = re.search(r'<video[^>]+src="([^"]+)"', r.text)
    if not m:
        raise RuntimeError("Post do Telegram sem vídeo")
    return m.group(1).replace("&amp;", "&")


def baixar(url: str, pasta: Path) -> tuple[Path, dict]:
    origem = url
    if "://t.me/" in url:
        url = resolver_telegram(url)
    opcoes = {
        "outtmpl": str(pasta / "origem.%(ext)s"),
        "format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
    }
    if os.environ.get("YTDLP_PROXY"):
        opcoes["proxy"] = os.environ["YTDLP_PROXY"]  # WARP: evita bloqueio de IP de servidor
    cookies = os.environ.get("YTDLP_COOKIES")
    if cookies:
        arq = pasta / "cookies.txt"
        arq.write_text(cookies, encoding="utf-8")
        opcoes["cookiefile"] = str(arq)
    # sites como o Dailymotion às vezes falham de forma passageira: tenta 3 vezes
    for tentativa in range(3):
        try:
            with yt_dlp.YoutubeDL(opcoes) as ydl:
                info = ydl.extract_info(url, download=True)
            break
        except yt_dlp.utils.DownloadError:
            if tentativa == 2:
                raise
            time.sleep(10 * (tentativa + 1))
    arquivo = next(p for p in pasta.iterdir() if p.name.startswith("origem.") and p.suffix != ".part")
    meta = {
        "titulo": info.get("title"),
        "descricao": (info.get("description") or "")[:1500],
        "autor": info.get("uploader") or info.get("channel") or info.get("uploader_id") or (origem.split("/")[3] if "://t.me/" in origem else None),
        "plataforma": info.get("extractor_key"),
        "duracao": info.get("duration"),
        "data": info.get("upload_date"),
    }
    return arquivo, meta


def baixar_molde(categoria: str, pasta: Path, rede: str) -> Path:
    """Molde enviado pelo painel (Storage) ou o padrão do repositório, por rede."""
    campo = "molde_ig_url" if rede == "instagram" else "molde_url"
    cat = db_get("categorias", f"slug=eq.{categoria}", campo)
    url = cat[0][campo] if cat else None
    if url:
        r = requests.get(url, timeout=60)
        if r.ok:
            arq = pasta / f"molde-{rede}.png"
            arq.write_bytes(r.content)
            return arq
    return molde_padrao(categoria, rede)


# ---------- Processo ----------

def processar(reel_id: str, auto_publicar: bool) -> None:
    linhas = db_get("reels", f"id=eq.{reel_id}", "*,tendencias(titulo,titulo_pt,resumo,noticias,pais)")
    if not linhas:
        sys.exit(f"Reel {reel_id} não encontrado")
    reel = linhas[0]
    db_patch("reels", f"id=eq.{reel_id}", {"status": "processando", "erro": None})

    pasta = Path(tempfile.mkdtemp(prefix="reel-"))
    try:
        print("⬇️  baixando", reel["origem_url"])
        video, meta = baixar(reel["origem_url"], pasta)

        tend = reel.get("tendencias") or {}
        contexto = {
            "categoria": reel["categoria"],
            "titulo_original": meta["titulo"] or reel.get("origem_titulo"),
            "descricao_original": meta["descricao"],
            "autor": meta["autor"] or reel.get("origem_autor"),
            "plataforma": meta["plataforma"],
            "assunto_em_alta": tend.get("titulo_pt") or tend.get("titulo"),
            "resumo_do_assunto": tend.get("resumo"),
            "manchetes_relacionadas": [n.get("titulo") for n in (tend.get("noticias") or [])][:4],
            "pais": tend.get("pais"),
            "duracao_video_seg": meta.get("duracao"),
            # ~2,5 palavras por segundo, no máximo 40 s de fala
            "limite_palavras_narracao": int(min(40, max(8, (meta.get("duracao") or 30))) * 2.5),
        }
        # entender o vídeo: fala original (Whisper) + quadros para a IA ver
        imagens: list[str] = []
        try:
            from entender import quadros, transcrever
            print("👂 transcrevendo o áudio original")
            fala = transcrever(video)
            contexto["_fala"] = fala
            if fala["texto"]:
                contexto["transcricao_original"] = fala["texto"]
                contexto["idioma_original"] = fala["idioma"]
            imagens = quadros(video, pasta, meta.get("duracao") or 30)
        except Exception as e:  # sem isso a IA escreve só com título/descrição
            print("aviso: não foi possível analisar o vídeo:", e)

        print("✍️  escrevendo textos")
        cfg_apr = db_get("config", "chave=eq.aprendizados", "valor")
        aprendizados = (cfg_apr[0]["valor"] or {}).get("texto", "") if cfg_apr else ""
        textos = gerar_textos(contexto, aprendizados, imagens)
        # categoria: a IA confirma pelo assunto, a menos que tenha sido escolhida a dedo
        if reel.get("categoria_auto", True) and textos.get("categoria") and textos["categoria"] != reel["categoria"]:
            print(f"🏷️  categoria: {reel['categoria']} → {textos['categoria']}")
            reel["categoria"] = textos["categoria"]

        cfg = db_get("config", "chave=eq.rodape", "valor")
        rodape = cfg[0]["valor"] if cfg else ""

        # narração em português + legendas (conteúdo transformado: conta para a monetização)
        cfg_narr = db_get("config", "chave=eq.narracao", "valor")
        narr_cfg = (cfg_narr[0]["valor"] if cfg_narr else None) or {}
        narracao_wav, trechos = None, None
        fala = contexto.pop("_fala", None) or {}
        fala_pt = fala.get("idioma") == "pt" and fala.get("palavras", 0) >= 8
        modo = reel.get("narracao_modo") or "auto"
        if modo == "sim":
            narrar_agora = True
        elif modo == "nao":
            narrar_agora = False
        else:  # automático: ligado nos Ajustes + IA decide, e nunca por cima de fala em português
            narrar_agora = bool(narr_cfg.get("ativa")) and bool(textos.get("usar_narracao", True)) and not fala_pt
        if narrar_agora and textos.get("narracao"):
            from narracao import narrar
            print("🎙️  narrando em português")
            narracao_wav = pasta / "narracao.wav"
            trechos = narrar(textos["narracao"], narracao_wav, narr_cfg.get("voz", "cadu"))
        elif fala_pt:
            # fala em português: mantém o áudio original e legenda o que é dito
            from entender import legendas_da_fala
            print("💬 legendando a fala em português")
            trechos = legendas_da_fala(fala["segmentos"])
        corte = (reel.get("corte_inicio"), reel.get("corte_fim"))

        print("🎬 montando versão Facebook/site")
        saida = pasta / "reel.mp4"
        res = montar(video, baixar_molde(reel["categoria"], pasta, "facebook"), textos["manchete"], rodape, saida, *corte,
                     rede="facebook", narracao=narracao_wav, trechos=trechos)
        print("🎬 montando versão Instagram")
        saida_ig = pasta / "reel-ig.mp4"
        montar(video, baixar_molde(reel["categoria"], pasta, "instagram"), textos["manchete"], rodape, saida_ig, *corte,
               rede="instagram", narracao=narracao_wav, trechos=trechos)

        print("☁️  enviando")
        url_video = enviar_arquivo(f"{reel_id}.mp4", saida, "video/mp4")
        url_video_ig = enviar_arquivo(f"{reel_id}-ig.mp4", saida_ig, "video/mp4")
        url_capa = enviar_arquivo(f"{reel_id}.jpg", res["capa"], "image/jpeg")

        db_patch("reels", f"id=eq.{reel_id}", {
            "status": "pronto",
            "manchete": textos["manchete"],
            "legenda": textos["legenda"],
            "artigo": textos.get("artigo"),
            "narracao": textos.get("narracao"),
            "categoria": reel["categoria"],
            "hashtags": textos["hashtags"],
            "video_path": f"{BUCKET}/{reel_id}.mp4",
            "video_url": url_video,
            "video_ig_url": url_video_ig,
            "thumb_url": url_capa,
            "duracao": res["duracao"],
            "origem_autor": contexto["autor"],
            "origem_titulo": contexto["titulo_original"],
            "origem_plataforma": meta["plataforma"],
        })
        print("✅ pronto:", url_video)

        if auto_publicar:
            print("📤 publicando no Facebook")
            r = requests.post(
                f"{os.environ['WORKER_URL'].rstrip('/')}/api/interno/publicar/{reel_id}",
                headers={"x-internal-secret": os.environ["INTERNAL_SECRET"]}, timeout=300,
            )
            print(r.status_code, r.text)
            r.raise_for_status()
            print("📤 publicando no Instagram")
            ri = requests.post(
                f"{os.environ['WORKER_URL'].rstrip('/')}/api/interno/publicar-instagram/{reel_id}",
                headers={"x-internal-secret": os.environ["INTERNAL_SECRET"]}, timeout=400,
            )
            print(ri.status_code, ri.text)
    except Exception as e:
        traceback.print_exc()
        msg = str(e).splitlines()[0][:500] if str(e) else type(e).__name__
        db_patch("reels", f"id=eq.{reel_id}", {"status": "erro", "erro": msg})
        sys.exit(1)
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


def limpar(dias: int = 7) -> None:
    """Apaga do storage vídeos publicados/rejeitados há mais de N dias (plano grátis = 1 GB)."""
    limite = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
    velhos = db_get("reels", f"status=in.(publicado,rejeitado,erro)&atualizado_em=lt.{limite}&video_path=not.is.null", "id")
    for r in velhos:
        nomes = [f"{r['id']}.mp4", f"{r['id']}-ig.mp4", f"{r['id']}.jpg"]
        requests.delete(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}", headers=HDR, json={"prefixes": nomes}, timeout=30)
        db_patch("reels", f"id=eq.{r['id']}", {"video_path": None, "video_url": None, "video_ig_url": None, "thumb_url": None})
    print(f"🧹 {len(velhos)} vídeos removidos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reel")
    ap.add_argument("--auto-publicar", action="store_true")
    ap.add_argument("--limpar", action="store_true")
    a = ap.parse_args()
    if a.limpar:
        limpar()
    elif a.reel:
        processar(a.reel, a.auto_publicar)
    else:
        ap.print_help()
