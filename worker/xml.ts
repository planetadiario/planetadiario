// Parser mínimo de RSS (Workers não têm DOMParser)

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificar(s: string): string {
  return s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+);/g, (m, n) => ENTIDADES[n] ?? m)
    .trim();
}

export function itens(xml: string, nome = "item"): string[] {
  return [...xml.matchAll(new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, "g"))].map((m) => m[1]);
}

export function tag(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? decodificar(m[1]) : undefined;
}
