// Constantes de arte ASCII decorativa do chrome (FR-009/FR-010,
// docs/specs/14-identidade-fanzine-crt/spec.md). São puro texto: nenhuma
// importação, nenhum DOM — por isso o teste de largura as lê sem renderizar.
//
// ORÇAMENTO DE LARGURA: cada linha ≤ 26 colunas (AC-005). A coluna útil em 320px é
// 272px (320 − 2×24 do `px-6` do PageShell) e o <pre> herda 16px; uma mono ocupa
// ~0,62em por coluna, então 26 colunas ≈ 258px e cabem sem rolagem horizontal. O
// teste prova esse cálculo, não só a contagem de colunas — ver ascii.test.ts.
//
// As artes NÃO contêm a marca "rockncine" de propósito: o texto que elas ilustram
// vive como conteúdo acessível próprio (o `h1`), e repetir a marca dentro da
// decoração tornaria as consultas por papel ambíguas (FR-009).

/** Hero da landing: um cartucho de fita, sem texto de marca. */
export const HERO_ART = [
  "   __________________",
  "  /                  \\",
  " |  () () () () ()    |",
  " |  [============]    |",
  "  \\__________________/",
];

/** Estado de 404 — a rota não existe. */
export const NOT_FOUND_ART = [
  "    +------------+",
  "    |   4 0 4    |",
  "    | sem sinal  |",
  "    +------------+",
];

/** Estados de erro (500 / boundary) — algo quebrou, não a rota. */
export const ERROR_ART = [
  "    +------------+",
  "    |  erro 500  |",
  "    | sem sinal  |",
  "    +------------+",
];
