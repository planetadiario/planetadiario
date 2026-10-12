"""Narração em português (Piper, voz neural offline e gratuita) + legendas ASS sincronizadas."""
import re
import wave
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
VOZES = RAIZ / "vozes"
URL_VOZ = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/{n}/medium/pt_BR-{n}-medium.{ext}"
TAXA_FALA = 2.5  # palavras por segundo (para a IA dimensionar o texto)


def garantir_voz(nome: str) -> Path:
    """Baixa o modelo da voz na primeira vez (fica no cache do GitHub Actions)."""
    import requests

    VOZES.mkdir(exist_ok=True)
    modelo = VOZES / f"pt_BR-{nome}-medium.onnx"
    for ext in ("onnx", "onnx.json"):
        arq = VOZES / f"pt_BR-{nome}-medium.{ext}"
        if not arq.exists():
            r = requests.get(URL_VOZ.format(n=nome, ext=ext), timeout=300)
            r.raise_for_status()
            arq.write_bytes(r.content)
    return modelo


def frases(texto: str) -> list[str]:
    return [f.strip() for f in re.split(r"(?<=[.!?])\s+", texto.strip()) if f.strip()]


def narrar(texto: str, destino: Path, voz: str = "cadu") -> list[tuple[float, float, str]]:
    """Gera o .wav da narração e devolve os trechos de legenda [(início, fim, texto)].

    Cada frase é sintetizada separadamente: assim sabemos exatamente onde começa e termina,
    e dentro da frase os blocos de 3–5 palavras são distribuídos pelo tamanho do texto.
    """
    from piper import PiperVoice

    grave = voz.endswith("-grave")
    v = PiperVoice.load(str(garantir_voz(voz.removesuffix("-grave"))))
    pausa = 0.18
    trechos: list[tuple[float, float, str]] = []
    quadros = b""
    taxa = canais = largura = None
    t = 0.0
    for frase in frases(texto):
        tmp = destino.with_suffix(".frase.wav")
        with wave.open(str(tmp), "wb") as w:
            v.synthesize_wav(frase, w)
        with wave.open(str(tmp), "rb") as r:
            taxa, canais, largura = r.getframerate(), r.getnchannels(), r.getsampwidth()
            dados = r.readframes(r.getnframes())
            dur = r.getnframes() / taxa
        quadros += dados + b"\x00" * int(taxa * pausa) * canais * largura
        # blocos de legenda dentro da frase, proporcionais ao número de letras
        palavras = frase.split()
        blocos, atual = [], []
        for p in palavras:
            atual.append(p)
            if len(atual) >= 4 or (len(" ".join(atual)) > 22 and len(atual) >= 2):
                blocos.append(" ".join(atual))
                atual = []
        if atual:
            blocos.append(" ".join(atual))
        total = sum(len(b) for b in blocos) or 1
        ini = t
        for b in blocos:
            fim = ini + dur * len(b) / total
            trechos.append((ini, fim, b))
            ini = fim
        t += dur + pausa
        tmp.unlink(missing_ok=True)

    with wave.open(str(destino), "wb") as w:
        w.setnchannels(canais)
        w.setsampwidth(largura)
        w.setframerate(taxa)
        w.writeframes(quadros)
    if grave:
        engrossar(destino, taxa)
    return trechos


def engrossar(arq: Path, taxa: int, fator: float = 0.86) -> None:
    """Abaixa o tom da voz (~2,5 semitons) mantendo a duração, para soar mais grave."""
    import subprocess

    tmp = arq.with_suffix(".grave.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(arq),
         "-af", f"asetrate={int(taxa * fator)},aresample={taxa},atempo={1 / fator:.4f},bass=g=3",
         str(tmp)],
        check=True,
    )
    tmp.replace(arq)


def _tempo(s: float) -> str:
    h, resto = divmod(s, 3600)
    m, seg = divmod(resto, 60)
    return f"{int(h)}:{int(m):02d}:{seg:05.2f}"


def legendas_ass(trechos: list[tuple[float, float, str]], destino: Path, margem_inferior: int) -> Path:
    """Arquivo ASS: texto branco em negrito com contorno preto, centralizado (estilo Reels)."""
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legenda,Montserrat Legenda,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,7,2,2,90,90,{margem_inferior},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    linhas = [f"Dialogue: 0,{_tempo(a)},{_tempo(b)},Legenda,,0,0,0,,{txt.upper()}" for a, b, txt in trechos]
    destino.write_text(cab + "\n".join(linhas) + "\n", encoding="utf-8")
    return destino


def duracao_wav(arq: Path) -> float:
    with wave.open(str(arq), "rb") as r:
        return r.getnframes() / r.getframerate()
