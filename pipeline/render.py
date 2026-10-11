"""Monta o Reel 1080x1920: fundo desfocado + vídeo no centro + molde + manchete."""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent
MOLDES = RAIZ / "assets" / "moldes"
FONTE = RAIZ / "fonts" / "Anton-Regular.ttf"

W, H = 1080, 1920
# Área do vídeo: entre a logo e a faixa da categoria (medidas do molde escaladas p/ 1080x1920)
CAIXA_Y0, CAIXA_Y1 = 255, 1390
# Área da manchete: abaixo da faixa
TEXTO_Y0, TEXTO_Y1 = 1500, 1860
TEXTO_MARGEM = 70
DURACAO_MAX = 90


def quebrar(texto: str, fonte: ImageFont.FreeTypeFont, largura: int, draw: ImageDraw.ImageDraw) -> list[str]:
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if draw.textlength(teste, font=fonte) <= largura:
            atual = teste
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def camada(categoria: str, manchete: str, destino: Path) -> Path:
    """Molde da categoria + manchete numa única imagem transparente 1080x1920."""
    molde = MOLDES / f"{categoria}.png"
    if not molde.exists():
        molde = MOLDES / "noticias.png"
    im = Image.open(molde).convert("RGBA").resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(im)

    largura = W - 2 * TEXTO_MARGEM
    altura_max = TEXTO_Y1 - TEXTO_Y0
    for tam in range(104, 54, -4):
        fonte = ImageFont.truetype(str(FONTE), tam)
        linhas = quebrar(manchete, fonte, largura, d)
        alt_linha = int(tam * 1.12)
        if len(linhas) <= 3 and alt_linha * len(linhas) <= altura_max:
            break
    linhas = linhas[:3]
    y = TEXTO_Y0 + (altura_max - alt_linha * len(linhas)) // 2
    for linha in linhas:
        lw = d.textlength(linha, font=fonte)
        d.text(((W - lw) / 2, y), linha, font=fonte, fill="white", stroke_width=6, stroke_fill="black")
        y += alt_linha

    im.save(destino)
    return destino


def sondar(video: Path) -> dict:
    saida = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(video)],
        check=True, capture_output=True, text=True,
    ).stdout
    info = json.loads(saida)
    return {
        "duracao": float(info["format"].get("duration", 0)),
        "tem_audio": any(s["codec_type"] == "audio" for s in info["streams"]),
    }


def montar(video: Path, categoria: str, manchete: str, saida: Path,
           inicio: float | None = None, fim: float | None = None) -> dict:
    info = sondar(video)
    inicio = inicio or 0.0
    fim = min(fim or info["duracao"], inicio + DURACAO_MAX)
    duracao = max(3.0, fim - inicio)

    overlay = camada(categoria, manchete, saida.with_suffix(".overlay.png"))
    caixa_h = CAIXA_Y1 - CAIXA_Y0
    filtro = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=30:3,eq=brightness=-0.2[bg];"
        f"[0:v]scale={W}:{caixa_h}:force_original_aspect_ratio=decrease:force_divisible_by=2[fg];"
        f"[bg][fg]overlay=(W-w)/2:{CAIXA_Y0}+({caixa_h}-h)/2[v1];"
        f"[v1][1:v]overlay=0:0,fps=30,format=yuv420p[v]"
    )
    cmd = [
        "ffmpeg", "-y", "-ss", f"{inicio:.2f}", "-t", f"{duracao:.2f}", "-i", str(video),
        "-i", str(overlay), "-filter_complex", filtro, "-map", "[v]",
    ]
    if info["tem_audio"]:
        cmd += ["-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-profile:v", "high",
        "-movflags", "+faststart", str(saida),
    ]
    subprocess.run(cmd, check=True)

    capa = saida.with_suffix(".jpg")
    subprocess.run(
        ["ffmpeg", "-y", "-ss", "1", "-i", str(saida), "-frames:v", "1", "-q:v", "3", str(capa)],
        check=True, capture_output=True,
    )
    return {"duracao": round(duracao, 2), "capa": capa}
