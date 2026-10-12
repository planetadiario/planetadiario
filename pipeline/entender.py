"""Entende o vídeo antes de escrever: transcreve a fala original (Whisper) e extrai quadros para a IA ver."""
import base64
import subprocess
from pathlib import Path


def transcrever(video: Path, max_seg: float = 120) -> dict:
    """Fala original com tempos (qualquer idioma). Vazio se o vídeo não tiver fala."""
    import numpy as np
    from faster_whisper import WhisperModel

    # áudio decodificado pelo ffmpeg (16 kHz mono): evita depender da versão do PyAV
    bruto = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-t", str(max_seg), "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    if not bruto:
        return {"idioma": None, "texto": ""}
    audio = np.frombuffer(bruto, dtype=np.float32)

    modelo = WhisperModel("base", device="cpu", compute_type="int8")
    segmentos, info = modelo.transcribe(audio, vad_filter=True, beam_size=1)
    trechos, segs = [], []
    for s in segmentos:
        if s.start > max_seg:
            break
        trechos.append(f"[{int(s.start)}s] {s.text.strip()}")
        segs.append((s.start, s.end, s.text.strip()))
    palavras = sum(len(t.split()) for _, _, t in segs)
    return {"idioma": info.language, "texto": "\n".join(trechos)[:3500], "segmentos": segs, "palavras": palavras}


def legendas_da_fala(segs: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """Quebra a fala transcrita em blocos curtos (até 4 palavras) com tempos proporcionais."""
    blocos = []
    for ini, fim, texto in segs:
        palavras = texto.split()
        partes = [" ".join(palavras[i:i + 4]) for i in range(0, len(palavras), 4)] or [texto]
        total = sum(len(p) for p in partes) or 1
        t = ini
        for p in partes:
            d = (fim - ini) * len(p) / total
            blocos.append((t, t + d, p))
            t += d
    return blocos


def quadros(video: Path, pasta: Path, duracao: float, n: int = 6) -> list[str]:
    """n quadros espalhados pelo vídeo, em JPEG base64 (512 px), para a IA ler textos e cenas."""
    saida = []
    dur = max(1.0, min(duracao or 30, 90))
    for i in range(n):
        t = dur * (i + 0.5) / n
        arq = pasta / f"quadro{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.1f}", "-i", str(video), "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", str(arq)],
            check=False,
        )
        if arq.exists():
            saida.append(base64.b64encode(arq.read_bytes()).decode())
    return saida
