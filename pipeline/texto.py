"""Gera manchete, legenda e hashtags do Reel (NVIDIA/Nemotron ou Claude, conforme IA_MODELO)."""
import json
import os
import re

import anthropic
import requests

SISTEMA = """Você é o social media da página de Facebook "Planeta Diário", que posta Reels sobre tudo que está bombando no Brasil e no mundo.
Escreva SEMPRE em português do Brasil, num tom jornalístico, direto e envolvente.

Regras de veracidade (muito importante):
- Use apenas fatos presentes nas informações recebidas. Não invente nomes, números, locais, datas ou causas.
- Se as informações forem vagas, descreva o que o vídeo mostra de forma genérica ("Vídeo impressionante mostra...") em vez de inventar contexto.
- Não mude o sentido do fato (ex.: "cai de ponte" não é "a ponte caiu"). Não acrescente desfechos (hospital, prisão, morte) que não estejam nas informações.
- Nunca afirme algo não confirmado como fato; use "segundo relatos", "de acordo com" quando couber.

Você vai gerar:
1. manchete: a frase que vai GRAVADA no vídeo, logo abaixo da faixa da categoria. É a notícia em uma frase, no estilo de portal de notícias:
   - frase normal (só a primeira letra e nomes próprios em maiúscula), sem emoji, sem hashtag, sem ponto final;
   - entre 60 e 100 caracteres, com o essencial: quem, o quê, onde e quando (se souber);
   - chamativa e com tensão, para o leitor parar de rolar, mas 100% fiel aos fatos;
   - exemplo do padrão: "Homem morre após entrar em jaula de tigre em zoológico no Reino Unido neste sábado".
2. legenda: descrição do post no Facebook, com:
   - 1ª linha: gancho forte com 1 emoji (aparece antes do "ver mais", até ~100 caracteres);
   - 2 a 3 frases curtas de contexto;
   - uma pergunta verdadeira sobre o assunto, que convide a comentar (nunca iscas como "comente SIM" ou "marque um amigo");
   - se houver autor/canal original, inclua "🎥 Créditos: <autor>".
   Não coloque hashtags dentro da legenda.
3. artigo: texto da notícia para o site, com 2 a 4 parágrafos curtos (separados por linha em branco), em tom jornalístico, explicando o que aconteceu com os fatos disponíveis. Sem título, sem emoji, sem hashtag, sem inventar.
4. hashtags: de 5 a 8, sem o símbolo #, sem espaços, misturando termos amplos e específicos do assunto, e sempre incluindo "planetadiario".
5. categoria: a que melhor descreve o ASSUNTO do vídeo (vira a faixa vermelha do molde). Escolha pelo tema, não pela origem:
   ciência e espaço → "ciencia"; animais → "animais"; clima/desastres naturais → "natureza"; tecnologia/IA → "tecnologia";
   futebol e outros esportes → "esportes"; celebridades → "famosos"; crimes/segurança → "policia"; saúde → "saude";
   dinheiro/mercado → "economia"; fato grave de última hora → "urgente"; fato do Brasil sem tema específico → "noticias";
   fato internacional sem tema específico → "mundo"; vídeo inusitado que viralizou → "viral"; história tocante → "emocionante";
   engraçado → "humor"; fato curioso → "curiosidades".
6. usar_narracao (true/false): narração é a EXCEÇÃO, só quando o vídeo realmente precisa. Na dúvida, false.
   - true SOMENTE se: (a) há fala importante em outra língua que o brasileiro não entenderia; ou
     (b) há texto na tela em outra língua essencial para entender; ou (c) sem explicação o vídeo não faz sentido.
   - false quando: alguém fala em português; o som original é o conteúdo (animal, música, reação, humor,
     momento emocionante, impacto, multidão); o vídeo se explica sozinho pelas imagens.
7. narracao: SEMPRE escreva (a versão do Facebook é sempre narrada, mesmo com usar_narracao=false). É o texto que um narrador de telejornal vai LER em voz alta sobre o vídeo, em português do Brasil:
   - começa pelo fato mais impactante (o gancho tem que prender nos 2 primeiros segundos);
   - 2 a 4 frases curtas, linguagem falada e natural, sem emoji, sem hashtag, sem siglas difíceis;
   - acompanha o vídeo NA ORDEM: narra o que aparece em cada parte (use os quadros e a "transcricao_original"),
     citando os itens, nomes e textos que aparecem na tela — nada genérico como "uma seleção reúne fenômenos";
   - traduz para o português o que for dito ou escrito em outra língua;
   - respeite o limite de palavras informado ("limite_palavras_narracao");
   - 100% fiel aos fatos, sem inventar nada."""

CATEGORIAS = [
    "noticias", "urgente", "mundo", "esportes", "famosos", "curiosidades", "viral", "emocionante",
    "humor", "animais", "natureza", "ciencia", "tecnologia", "saude", "economia", "policia",
]

ESQUEMA = {
    "type": "object",
    "properties": {
        "manchete": {"type": "string"},
        "legenda": {"type": "string"},
        "artigo": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "categoria": {"type": "string", "enum": CATEGORIAS},
        "narracao": {"type": "string"},
        "usar_narracao": {"type": "boolean"},
    },
    "required": ["manchete", "legenda", "artigo", "hashtags", "categoria", "narracao", "usar_narracao"],
    "additionalProperties": False,
}


def sistema(aprendizados: str = "") -> str:
    """Prompt base + aprendizados do desempenho recente da página (auto-correção)."""
    if not aprendizados:
        return SISTEMA
    return (SISTEMA + "\n\nAprendizados do desempenho recente da página (siga-os ao escrever, "
            "sem nunca sacrificar a veracidade):\n" + aprendizados)


# reserva: se a NVIDIA desativar o modelo (aconteceu com o Kimi K3), usa o próximo; (modelo, vê imagens?)
RESERVA_NVIDIA = [("nvidia/nemotron-3.5-super-vl-120b-a12b", True), ("nvidia/nemotron-3-super-120b-a12b", False), ("z-ai/glm-5.3", False)]


def _nvidia(modelo: str, usuario: str, prompt: str, imagens: list[str]) -> dict:
    tentativas = [(modelo, True)] + [r for r in RESERVA_NVIDIA if r[0] != modelo]
    for i, (m, ve_imagens) in enumerate(tentativas):
        try:
            return _nvidia_modelo(m, usuario, prompt, imagens if ve_imagens else [])
        except requests.HTTPError as e:
            if e.response is None or e.response.status_code not in (404, 410) or i == len(tentativas) - 1:
                raise
            print(f"aviso: modelo {m} indisponível ({e.response.status_code}), usando o próximo")
    raise RuntimeError("nenhum modelo disponível")


def _nvidia_modelo(modelo: str, usuario: str, prompt: str, imagens: list[str]) -> dict:
    r = requests.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['NVIDIA_API_KEY']}"},
        json={
            "model": modelo, "max_tokens": 8000, "temperature": 0.6,
            "messages": [
                {"role": "system", "content": prompt + "\n\nResponda APENAS com JSON válido neste esquema:\n" + json.dumps(ESQUEMA)},
                {"role": "user", "content": [{"type": "text", "text": usuario}] + [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b}"}} for b in imagens
                ]},
            ],
        },
        timeout=300,
    )
    r.raise_for_status()
    texto = r.json()["choices"][0]["message"]["content"] or ""
    m = re.search(r"\{.*\}", texto, re.S)
    if not m:
        raise RuntimeError("IA não devolveu JSON")
    return json.loads(m.group(0))


def gerar_textos(contexto: dict, aprendizados: str = "", imagens: list[str] | None = None) -> dict:
    modelo = os.environ.get("IA_MODELO", "nvidia/nemotron-3.5-super-vl-120b-a12b")
    imagens = imagens or []
    usuario = "Informações sobre o vídeo:\n" + json.dumps(contexto, ensure_ascii=False, indent=2)
    if imagens:
        usuario += (f"\n\nAs {len(imagens)} imagens anexadas são quadros do vídeo, em ordem. Use-as (e a transcrição) para saber "
                    "o que realmente aparece e o que está escrito na tela.")
    prompt = sistema(aprendizados)
    dados = _claude(modelo, usuario, prompt, imagens) if modelo.startswith("claude") else _nvidia(modelo, usuario, prompt, imagens)
    if dados.get("categoria") not in CATEGORIAS:
        dados["categoria"] = None
    dados["manchete"] = dados["manchete"].strip().rstrip(".")[:120]
    dados["hashtags"] = [h.lstrip("#").replace(" ", "") for h in dados["hashtags"] if h.strip()][:8]
    if "planetadiario" not in [h.lower() for h in dados["hashtags"]]:
        dados["hashtags"].append("planetadiario")
    return dados


def _claude(modelo: str, usuario: str, prompt: str, imagens: list[str]) -> dict:
    client = anthropic.Anthropic()
    resposta = client.beta.messages.create(
        model=modelo,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": ESQUEMA}},
        system=prompt,
        messages=[{
            "role": "user",
            "content": [{"type": "text", "text": usuario}] + [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b}} for b in imagens
            ],
        }],
    )
    if resposta.stop_reason == "refusal":
        raise RuntimeError("Claude recusou gerar o texto deste vídeo")
    texto = next(b.text for b in resposta.content if b.type == "text")
    return json.loads(texto)
