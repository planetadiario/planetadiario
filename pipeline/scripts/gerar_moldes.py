"""Gera um molde PNG por categoria a partir do molde original.

Apaga a faixa "NOTÍCIAS" do molde original e redesenha a linha + pílula
vermelha com o rótulo de cada categoria. Rodar localmente (precisa de uma
fonte bold; no Windows usa Arial Black):

    python pipeline/scripts/gerar_moldes.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "assets" / "molde-original.png"
SAIDA = ROOT / "assets" / "moldes"

# Medidas extraídas do molde original (1152x2048)
LINHA_X0, LINHA_X1 = 85, 1021
LINHA_Y0, LINHA_Y1 = 1533, 1537
PILULA_Y0, PILULA_Y1 = 1500, 1570  # faixa um pouco menor que a original (1491–1579)
PILULA_RAIO = 10
PILULA_PAD = 14
PILULA_MIN = 0
FONTE_TAM = 44
# logo (globo + nome) no canto superior direito, reduzida
LOGO_CAIXA = (505, 110, 1045, 290)
LOGO_ESCALA = 0.78

FONTES = [
    "C:/Windows/Fonts/ariblk.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def carregar_fonte():
    for f in FONTES:
        if Path(f).exists():
            return ImageFont.truetype(f, FONTE_TAM)
    sys.exit("Nenhuma fonte bold encontrada")


def gerar(label: str, cor: str, fonte) -> Image.Image:
    im = Image.open(ORIGINAL).convert("RGBA")
    # reduz a logo mantendo o canto superior direito no lugar
    logo = im.crop(LOGO_CAIXA)
    nova = logo.resize((round(logo.width * LOGO_ESCALA), round(logo.height * LOGO_ESCALA)), Image.LANCZOS)
    im.paste((0, 0, 0, 0), LOGO_CAIXA)
    im.alpha_composite(nova, (LOGO_CAIXA[2] - nova.width, LOGO_CAIXA[1]))
    d = ImageDraw.Draw(im)
    # apaga a faixa original
    d.rectangle([0, 1484, im.width, 1586], fill=(0, 0, 0, 0))  # faixa original inteira

    tx0, ty0, tx1, ty1 = d.textbbox((0, 0), label, font=fonte)
    tw, th = tx1 - tx0, ty1 - ty0
    pw = max(PILULA_MIN, tw + 2 * PILULA_PAD)
    cx = 548  # centro da pílula no molde original
    px0, px1 = cx - pw // 2, cx + pw // 2

    d.rectangle([LINHA_X0, LINHA_Y0, LINHA_X1, LINHA_Y1], fill=cor)
    d.rounded_rectangle([px0, PILULA_Y0, px1, PILULA_Y1], radius=PILULA_RAIO, fill=cor)
    cy = (PILULA_Y0 + PILULA_Y1) // 2 - 5
    d.text((cx - tw // 2 - tx0, cy - th // 2 - ty0), label, font=fonte, fill="white")
    return im


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    fonte = carregar_fonte()
    cats = json.loads((ROOT / "categorias.json").read_text(encoding="utf-8"))
    for c in cats:
        gerar(c["label"], c["cor"], fonte).save(SAIDA / f"{c['slug']}.png", optimize=True)
        print("ok", c["slug"])


if __name__ == "__main__":
    main()
