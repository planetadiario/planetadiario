"""Redesenha o texto "PLANETA DIÁRIO" do molde original com fonte limpa (mantém o globo)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parents[1]
ARQ = RAIZ / "assets" / "molde-original.png"
X0, Y0, Y1 = 700, 127, 262  # área do texto ao lado do globo


def fonte(tam: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(RAIZ / "fonts" / "Montserrat.ttf"), tam)
    f.set_variation_by_name("ExtraBold")
    return f


im = Image.open(ARQ).convert("RGBA")
d = ImageDraw.Draw(im)
d.rectangle([690, 95, im.width, 295], fill=(0, 0, 0, 0))

# maior tamanho em que as duas linhas cabem na altura do globo
for tam in range(90, 40, -1):
    f = fonte(tam)
    b1, b2 = d.textbbox((0, 0), "PLANETA", font=f), d.textbbox((0, 0), "DIÁRIO", font=f)
    gap = int(tam * 0.06)
    if (b1[3] - b1[1]) + (b2[3] - b2[1]) + gap <= Y1 - Y0 and b1[2] - b1[0] <= 335:
        break

texto = Image.new("RGBA", im.size, (0, 0, 0, 0))
t = ImageDraw.Draw(texto)
y = Y0 - b1[1]
t.text((X0 - b1[0], y), "PLANETA", font=f, fill="white")
y2 = Y0 + (b1[3] - b1[1]) + gap - b2[1]
t.text((X0 - b2[0], y2), "DIÁRIO", font=f, fill="white")

sombra = Image.new("RGBA", im.size, (0, 0, 0, 0))
sombra.putalpha(texto.getchannel("A").point(lambda a: int(a * 0.45)))
sombra = sombra.filter(ImageFilter.GaussianBlur(4))
im.alpha_composite(sombra, (2, 3))
im.alpha_composite(texto)
im.save(ARQ, optimize=True)
print("fonte", tam)
