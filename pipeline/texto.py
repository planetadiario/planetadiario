"""Gera manchete, legenda e hashtags do Reel com o Claude."""
import json
import os

import anthropic

SISTEMA = """Você é o social media da página de Facebook "Planeta Diário", que posta Reels sobre tudo que está bombando no Brasil e no mundo.
Escreva SEMPRE em português do Brasil, num tom jornalístico, direto e envolvente.

Regras de veracidade (muito importante):
- Use apenas fatos presentes nas informações recebidas. Não invente nomes, números, locais, datas ou causas.
- Se as informações forem vagas, descreva o que o vídeo mostra de forma genérica ("Vídeo impressionante mostra...") em vez de inventar contexto.
- Nunca afirme algo não confirmado como fato; use "segundo relatos", "de acordo com" quando couber.

Você vai gerar:
1. manchete: texto que vai GRAVADO no vídeo, abaixo da faixa da categoria. Máximo 60 caracteres, em MAIÚSCULAS, sem emoji, sem hashtag. Precisa prender nos 2 primeiros segundos (curiosidade ou impacto), sem ser enganosa.
2. legenda: descrição do post no Facebook, com:
   - 1ª linha: gancho forte com 1 emoji (aparece antes do "ver mais", até ~100 caracteres);
   - 2 a 3 frases curtas de contexto;
   - uma pergunta que convide a comentar (gera engajamento);
   - linha final: "📌 Siga a Planeta Diário para acompanhar tudo que acontece no mundo."
   - se houver autor/canal original, inclua "🎥 Créditos: <autor>".
   Não coloque hashtags dentro da legenda.
3. hashtags: de 5 a 8, sem o símbolo #, sem espaços, misturando termos amplos e específicos do assunto, e sempre incluindo "planetadiario"."""

ESQUEMA = {
    "type": "object",
    "properties": {
        "manchete": {"type": "string"},
        "legenda": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["manchete", "legenda", "hashtags"],
    "additionalProperties": False,
}


def gerar_textos(contexto: dict) -> dict:
    client = anthropic.Anthropic()
    resposta = client.beta.messages.create(
        model=os.environ.get("CLAUDE_MODEL", "claude-opus-5-5"),
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": ESQUEMA}},
        system=SISTEMA,
        messages=[{
            "role": "user",
            "content": "Informações sobre o vídeo:\n" + json.dumps(contexto, ensure_ascii=False, indent=2),
        }],
    )
    if resposta.stop_reason == "refusal":
        raise RuntimeError("Claude recusou gerar o texto deste vídeo")
    texto = next(b.text for b in resposta.content if b.type == "text")
    dados = json.loads(texto)
    dados["manchete"] = dados["manchete"].strip().upper()[:70]
    dados["hashtags"] = [h.lstrip("#").replace(" ", "") for h in dados["hashtags"] if h.strip()][:8]
    if "planetadiario" not in [h.lower() for h in dados["hashtags"]]:
        dados["hashtags"].append("planetadiario")
    return dados
