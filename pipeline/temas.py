"""Coleta do Google Notícias feita no GitHub Actions (o Google bloqueia os servidores do Cloudflare).

Traz as notícias das últimas 24 h dos temas monitorados (Ajustes → Fontes, ex.: "A Fazenda")
e as manchetes principais do Brasil, e grava em `tendencias` para o worker analisar.
Só usa a biblioteca padrão do Python (roda sem instalar nada).
"""
import email.utils
import json
import os
import re
import urllib.parse
import urllib.request
from html import unescape

SUPA = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
CHAVE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CAB = {"apikey": CHAVE, "Authorization": f"Bearer {CHAVE}", "Content-Type": "application/json"}
NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
BR = "hl=pt-BR&gl=BR&ceid=BR:pt-419"


def pedir(url, dados=None, cab=None, metodo=None):
    req = urllib.request.Request(url, data=json.dumps(dados).encode() if dados is not None else None,
                                 headers=cab or {"User-Agent": NAVEGADOR}, method=metodo)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def tag(item, nome):
    m = re.search(rf"<{nome}[^>]*>(.*?)</{nome}>", item, re.S)
    return unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))).strip() if m else ""


def noticias(url, tema=None, limite=15):
    xml = pedir(url)
    saida = []
    for it in re.findall(r"<item>(.*?)</item>", xml, re.S):
        fonte, link, titulo = tag(it, "source"), tag(it, "link"), tag(it, "title")
        if fonte and titulo.endswith(f" - {fonte}"):
            titulo = titulo[: -len(fonte) - 3]
        publicado = tag(it, "pubDate")
        if not titulo or not link:
            continue
        saida.append({
            "fonte": "google_news", "pais": "BR", "chave": link, "titulo": titulo, "url": link,
            "noticias": [{"titulo": titulo, "url": link, "fonte": fonte}],
            "extra": {"autor": fonte, "publicado": publicado, **({"tema": tema} if tema else {})},
        })
    # mais novas primeiro
    saida.sort(key=lambda t: email.utils.parsedate_to_datetime(t["extra"]["publicado"]).timestamp() if t["extra"]["publicado"] else 0, reverse=True)
    return saida[:limite]


def main():
    cfg = json.loads(pedir(f"{SUPA}/config?chave=eq.temas_monitorados&select=valor", cab=CAB))
    temas = (cfg[0]["valor"] if cfg else None) or ["A Fazenda"]
    lote = []
    for tema in temas[:5]:
        q = urllib.parse.quote(f'"{tema}" when:1d')
        try:
            achadas = noticias(f"https://news.google.com/rss/search?q={q}&{BR}", tema)
            print(f"{tema}: {len(achadas)} notícias")
            lote += achadas
        except Exception as e:
            print(f"{tema}: falhou ({e})")
    try:
        topo = noticias(f"https://news.google.com/rss?{BR}", limite=25)
        print(f"manchetes do Brasil: {len(topo)}")
        lote += topo
    except Exception as e:
        print(f"manchetes do Brasil: falhou ({e})")
    lote = list({t["chave"]: t for t in lote}.values())
    if lote:
        # ignora as que já existem (não apaga a análise já feita)
        pedir(f"{SUPA}/tendencias?on_conflict=fonte,chave", lote,
              {**CAB, "Prefer": "resolution=ignore-duplicates,return=minimal"}, "POST")
    print(f"gravadas/atualizadas: {len(lote)}")


if __name__ == "__main__":
    main()
