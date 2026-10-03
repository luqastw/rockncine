// Identidade visual do participante, sem matiz.
//
// A direção do app é monocromática: estado é sinalizado por contraste, inversão
// ou peso, nunca por cor (app/globals.css, FR-004 da spec 01, seção 8). Avatar
// colorido por participante é a primeira coisa que um produto de sala tem e que
// aqui é proibido — então a diferenciação é por FORMA (iniciais) e por PESO
// (um de quatro tons de cinza derivados do `userId`).
//
// Os quatro tons são `--id-1..4` em `app/globals.css`: todos passam de 4,5:1
// contra `--pure-black` no texto da inicial e contra `--bg-surface` na borda,
// então nenhum estado depende de cor para ser distinguível.

/** Quantos tons existem. Mudar aqui exige mudar os tokens junto. */
export const IDENTITY_TONES = 4;

function hash(text: string): number {
  // FNV-1a de 32 bits: barato, sem estado e estável entre recargas. Não é
  // criptografia — é distribuição, e o objetivo é só não largar todo mundo no
  // mesmo tom.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Tom (0–3) do participante.
 *
 * A entrada é o `userId` e não o nome: nome é digitável, e trocar o nome não
 * pode trocar a cara do participante no meio da sala. O id já vem do
 * Liveblocks como parte da presence.
 */
export function toneOf(userId: string): number {
  if (!userId) return 0;
  return hash(userId) % IDENTITY_TONES;
}

/** Classe CSS do token de tom, para o JSX não montar string de cor. */
export function toneToken(tone: number): string {
  const normalized = ((tone % IDENTITY_TONES) + IDENTITY_TONES) % IDENTITY_TONES;
  return `var(--id-${normalized + 1})`;
}

// Letra Latina: o app é pt-BR e os nomes vêm do cadastro. A faixa cobre
// basic latin (A–Z, a–z) e o Latin-1 Supplement mais o Latim estendido, onde
// caem á à â ã ç é ê í ó õ ú. CJK, emoji e símbolos não são letra — e uma
// "inicial" que é um ideograma ou um bloco de emoji ocupa a mesma caixa que a
// inicial de verdade e não distingue nada.
function isLatinLetter(codePoint: number): boolean {
  return (
    (codePoint >= 0x41 && codePoint <= 0x5a) ||
    (codePoint >= 0x61 && codePoint <= 0x7a) ||
    (codePoint >= 0xc0 && codePoint <= 0x24f)
  );
}

function firstLetterOf(word: string): string | null {
  for (const char of word) {
    if (isLatinLetter(char.codePointAt(0) ?? 0)) return char.toLocaleUpperCase("pt-BR");
  }
  return null;
}

/**
 * Iniciais do participante: até duas letras, das duas primeiras palavras do
 * nome que começam com letra. `ana maria` → `AM`, `bruno` → `B`, `7 bruno` → `B`
 * (a palavra `7` não tem letra nenhuma, e "7B" seria pior que "B").
 *
 * Sem nome (o usuário pode entrar sem `name` na presence) cai no "?" em vez de
 * string vazia: um quadrado vazio na lista de presença parece participante sem
 * nome nenhum, que é informação diferente.
 */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const letters: string[] = [];
  for (const word of trimmed.split(/\s+/).filter(Boolean)) {
    const letter = firstLetterOf(word);
    if (letter) letters.push(letter);
    if (letters.length === 2) break;
  }
  if (letters.length > 0) return letters.join("");

  // Nome sem nenhuma letra (emoji, símbolos, número): primeiro caractere como
  // está, para o quadrado não ficar vazio.
  return [...trimmed][0] ?? "?";
}