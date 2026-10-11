"""Monta o Reel 1080x1920 no padrão Planeta Diário.

Camadas: vídeo (tela cheia se vertical; centralizado com fundo desfocado se horizontal)
→ degradê escuro embaixo → molde da categoria → manchete → rodapé vermelho.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent
MOLDES = RAIZ / "assets" / "moldes"
FONTE = RAIZ / "fonts" / "Montserrat.ttf"

W, H = 1080, 1920
# Medidas no vídeo 1080x1920 para cada rede (os moldes de cada uma seguem as mesmas posições)
LAYOUTS = {
    # layout original: logo no topo, faixa e manchete embaixo
    "facebook": {"caixa": (255, 1390), "texto": (1500, 1800), "margem": 60, "degrade": 1180, "linhas": 4, "fonte": (72, 42)},
    # área segura do Instagram: o feed recorta 4:5 (y 285–1635) e a interface do Reel cobre a base
    "instagram": {"caixa": (450, 1150), "texto": (1236, 1545), "margem": 70, "degrade": 900, "linhas": 3, "fonte": (64, 38)},
}
COR_RODAPE = (255, 40, 40, 255)
DURACAO_MAX = 90


def fonte(tam: int, peso: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTE), tam)
    f.set_variation_by_name(peso)
    return f


def quebrar(texto: str, f: ImageFont.FreeTypeFont, largura: int, d: ImageDraw.ImageDraw) -> list[str]:
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if d.textlength(teste, font=f) <= largura or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def camada(molde: Path, manchete: str, rodape: str, destino: Path, layout: dict) -> Path:
    """Degradê + molde + manchete + rodapé numa imagem transparente 1080x1920."""
    DEGRADE_Y0, (TEXTO_Y0, TEXTO_Y1), TEXTO_MARGEM = layout["degrade"], layout["texto"], layout["margem"]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # degradê para leitura do texto
    grad = Image.new("L", (1, H - DEGRADE_Y0))
    for y in range(H - DEGRADE_Y0):
        grad.putpixel((0, y), int(225 * (y / (H - DEGRADE_Y0)) ** 0.8))
    preto = Image.new("RGBA", (W, H - DEGRADE_Y0), (0, 0, 0, 255))
    preto.putalpha(grad.resize((W, H - DEGRADE_Y0)))
    im.alpha_composite(preto, (0, DEGRADE_Y0))

    im.alpha_composite(Image.open(molde).convert("RGBA").resize((W, H), Image.LANCZOS))
    d = ImageDraw.Draw(im)

    # manchete: frase normal, negrito, centralizada, até 4 linhas
    largura = W - 2 * TEXTO_MARGEM
    f_rod = fonte(34, "SemiBold")
    alt_rod = 34 + 26 if rodape else 0
    altura_max = TEXTO_Y1 - TEXTO_Y0 - alt_rod
    maior, menor = layout["fonte"]
    for tam in range(maior, menor, -2):
        f = fonte(tam, "Bold")
        linhas = quebrar(manchete, f, largura, d)
        alt_linha = int(tam * 1.18)
        if len(linhas) <= layout["linhas"] and alt_linha * len(linhas) <= altura_max:
            break
    linhas = linhas[: layout["linhas"]]
    y = TEXTO_Y0 + 10
    for linha in linhas:
        lw = d.textlength(linha, font=f)
        d.text(((W - lw) / 2, y), linha, font=f, fill="white", stroke_width=3, stroke_fill=(0, 0, 0, 200))
        y += alt_linha

    if rodape:
        rw = d.textlength(rodape, font=f_rod)
        d.text(((W - rw) / 2, y + 14), rodape, font=f_rod, fill=COR_RODAPE)

    im.save(destino)
    return destino


def sondar(video: Path) -> dict:
    saida = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(video)],
        check=True, capture_output=True, text=True,
    ).stdout
    info = json.loads(saida)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    if str(v.get("tags", {}).get("rotate", "0")) in ("90", "270"):
        w, h = h, w
    return {
        "duracao": float(info["format"].get("duration", 0)),
        "tem_audio": any(s["codec_type"] == "audio" for s in info["streams"]),
        "vertical": h / w >= 1.2,
    }


def montar(video: Path, molde: Path, manchete: str, rodape: str, saida: Path,
           inicio: float | None = None, fim: float | None = None, rede: str = "facebook") -> dict:
    layout = LAYOUTS[rede]
    CAIXA_Y0, CAIXA_Y1 = layout["caixa"]
    info = sondar(video)
    inicio = inicio or 0.0
    fim = min(fim or info["duracao"], inicio + DURACAO_MAX)
    duracao = max(3.0, fim - inicio)

    overlay = camada(molde, manchete, rodape, saida.with_suffix(".overlay.png"), layout)
    if info["vertical"]:
        base = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}[v1];"
    else:
        caixa_h = CAIXA_Y1 - CAIXA_Y0
        base = (
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"boxblur=30:3,eq=brightness=-0.2[bg];"
            f"[0:v]scale={W}:{caixa_h}:force_original_aspect_ratio=decrease:force_divisible_by=2[fg];"
            f"[bg][fg]overlay=(W-w)/2:{CAIXA_Y0}+({caixa_h}-h)/2[v1];"
        )
    filtro = base + "[v1][1:v]overlay=0:0,fps=30,format=yuv420p[v]"

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


def molde_padrao(categoria: str, rede: str = "facebook") -> Path:
    pasta = RAIZ / "assets" / ("moldes-ig" if rede == "instagram" else "moldes")
    p = pasta / f"{categoria}.png"
    return p if p.exists() else pasta / "noticias.png"
