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
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{caminho}"


# ---------- Download ----------

def baixar(url: str, pasta: Path) -> tuple[Path, dict]:
    opcoes = {
        "outtmpl": str(pasta / "origem.%(ext)s"),
        "format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
    }
    cookies = os.environ.get("YTDLP_COOKIES")
    if cookies:
        arq = pasta / "cookies.txt"
        arq.write_text(cookies, encoding="utf-8")
        opcoes["cookiefile"] = str(arq)
    with yt_dlp.YoutubeDL(opcoes) as ydl:
        info = ydl.extract_info(url, download=True)
    arquivo = next(p for p in pasta.iterdir() if p.name.startswith("origem.") and p.suffix != ".part")
    meta = {
        "titulo": info.get("title"),
        "descricao": (info.get("description") or "")[:1500],
        "autor": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
        "plataforma": info.get("extractor_key"),
        "duracao": info.get("duration"),
        "data": info.get("upload_date"),
    }
    return arquivo, meta


def baixar_molde(categoria: str, pasta: Path) -> Path:
    """Molde enviado pelo painel (Storage) ou o padrão do repositório."""
    cat = db_get("categorias", f"slug=eq.{categoria}", "molde_url")
    url = cat[0]["molde_url"] if cat else None
    if url:
        r = requests.get(url, timeout=60)
        if r.ok:
            arq = pasta / "molde.png"
            arq.write_bytes(r.content)
            return arq
    return molde_padrao(categoria)


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
        }
        print("✍️  escrevendo textos")
        textos = gerar_textos(contexto)

        print("🎬 montando vídeo")
        molde = baixar_molde(reel["categoria"], pasta)
        cfg = db_get("config", "chave=eq.rodape", "valor")
        rodape = cfg[0]["valor"] if cfg else ""
        saida = pasta / "reel.mp4"
        res = montar(video, molde, textos["manchete"], rodape, saida,
                     reel.get("corte_inicio"), reel.get("corte_fim"))

        print("☁️  enviando")
        url_video = enviar_arquivo(f"{reel_id}.mp4", saida, "video/mp4")
        url_capa = enviar_arquivo(f"{reel_id}.jpg", res["capa"], "image/jpeg")

        db_patch("reels", f"id=eq.{reel_id}", {
            "status": "pronto",
            "manchete": textos["manchete"],
            "legenda": textos["legenda"],
            "hashtags": textos["hashtags"],
            "video_path": f"{BUCKET}/{reel_id}.mp4",
            "video_url": url_video,
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
        nomes = [f"{r['id']}.mp4", f"{r['id']}.jpg"]
        requests.delete(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}", headers=HDR, json={"prefixes": nomes}, timeout=30)
        db_patch("reels", f"id=eq.{r['id']}", {"video_path": None, "video_url": None, "thumb_url": None})
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
