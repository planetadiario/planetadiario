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

# Medidas extraídas do molde original (1152x2048)
LINHA_X0, LINHA_X1 = 85, 1021

# Duas versões de cada molde:
# - facebook: layout original (logo no topo, faixa embaixo)
# - instagram: tudo dentro da área segura (recorte 4:5 do feed e interface do Reel)
LAYOUTS = {
    "facebook": {"pasta": "moldes", "logo_topo": 110, "pilula": (1500, 1570), "linha": (1533, 1537)},
    "instagram": {"pasta": "moldes-ig", "logo_topo": 330, "pilula": (1236, 1306), "linha": (1269, 1273)},
}
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


def gerar(label: str, cor: str, fonte, layout: dict) -> Image.Image:
    (PILULA_Y0, PILULA_Y1), (LINHA_Y0, LINHA_Y1) = layout["pilula"], layout["linha"]
    im = Image.open(ORIGINAL).convert("RGBA")
    # reduz a logo mantendo o canto superior direito no lugar
    logo = im.crop(LOGO_CAIXA)
    nova = logo.resize((round(logo.width * LOGO_ESCALA), round(logo.height * LOGO_ESCALA)), Image.LANCZOS)
    im.paste((0, 0, 0, 0), LOGO_CAIXA)
    im.alpha_composite(nova, (LOGO_CAIXA[2] - nova.width, layout["logo_topo"]))
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
    fonte = carregar_fonte()
    cats = json.loads((ROOT / "categorias.json").read_text(encoding="utf-8"))
    for nome, layout in LAYOUTS.items():
        saida = ROOT / "assets" / layout["pasta"]
        saida.mkdir(parents=True, exist_ok=True)
        for c in cats:
            gerar(c["label"], c["cor"], fonte, layout).save(saida / f"{c['slug']}.png", optimize=True)
        print("ok", nome, len(cats))


if __name__ == "__main__":
    main()
