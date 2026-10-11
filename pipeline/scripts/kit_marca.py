"""Gera o kit visual das redes (foto de perfil, capa do Facebook, capas de destaques)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
ORIG = RAIZ / "pipeline" / "assets" / "molde-original.png"
FONTE = RAIZ / "pipeline" / "fonts" / "Montserrat.ttf"
SAIDA = RAIZ / "marca"
VERMELHO, ESCURO = (229, 18, 27), (13, 17, 23)


def fonte(t, peso="ExtraBold"):
    f = ImageFont.truetype(str(FONTE), t)
    f.set_variation_by_name(peso)
    return f


orig = Image.open(ORIG).convert("RGBA")
globo = orig.crop((505, 115, 690, 275))           # globo + selo "P"
globo = globo.crop(globo.getbbox())
logo = orig.crop((505, 110, 1045, 290))
logo = logo.crop(logo.getbbox())

# 1) Foto de perfil 1080x1080 (círculo: o Facebook/Instagram recortam redondo)
perfil = Image.new("RGBA", (1080, 1080), ESCURO + (255,))
d = ImageDraw.Draw(perfil)
d.ellipse([40, 40, 1040, 1040], fill=(22, 28, 38, 255))
g = globo.resize((int(globo.width * 700 / globo.height), 700), Image.LANCZOS)
perfil.alpha_composite(g, ((1080 - g.width) // 2, (1080 - g.height) // 2))
perfil.convert("RGB").save(SAIDA / "foto-perfil.png")

# 2) Capa do Facebook 1640x856 (área segura central)
capa = Image.new("RGBA", (1640, 856), ESCURO + (255,))
d = ImageDraw.Draw(capa)
for i in range(856):  # leve degradê
    d.line([(0, i), (1640, i)], fill=(13 + i // 40, 17 + i // 40, 28 + i // 30, 255))
d.rectangle([0, 820, 1640, 856], fill=VERMELHO)
l = logo.resize((int(logo.width * 230 / logo.height), 230), Image.LANCZOS)
capa.alpha_composite(l, ((1640 - l.width) // 2, 200))
t1, t2 = "Tudo o que acontece no mundo, em vídeo.", "planetadiario.online"
f1, f2 = fonte(54, "Bold"), fonte(40, "SemiBold")
d.text(((1640 - d.textlength(t1, font=f1)) / 2, 490), t1, font=f1, fill="white")
d.text(((1640 - d.textlength(t2, font=f2)) / 2, 580), t2, font=f2, fill=VERMELHO)
capa.convert("RGB").save(SAIDA / "capa-facebook.png")

# 3) Capas de destaques do Instagram 1080x1920 (ícone central)
for nome, rotulo in [("noticias", "NOTÍCIAS"), ("mundo", "MUNDO"), ("esportes", "ESPORTES"),
                     ("viral", "VIRAL"), ("curiosidades", "CURIOSIDADES"), ("assine", "ASSINE")]:
    im = Image.new("RGBA", (1080, 1920), ESCURO + (255,))
    d = ImageDraw.Draw(im)
    d.ellipse([240, 660, 840, 1260], fill=VERMELHO)
    f = fonte(78 if len(rotulo) <= 9 else 60)
    w = d.textlength(rotulo, font=f)
    d.text(((1080 - w) / 2, 960 - 50), rotulo, font=f, fill="white")
    im.convert("RGB").save(SAIDA / f"destaque-{nome}.png")
print("ok")
