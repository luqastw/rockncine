// @vitest-environment node
// Lê components/chrome/ascii.ts como texto: a arte é uma constante de módulo,
// então o orçamento de largura se prova sem DOM.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ERROR_ART, HERO_ART, NOT_FOUND_ART } from "./ascii";

const ARTES = { HERO_ART, NOT_FOUND_ART, ERROR_ART };

// Métrica do Space Mono 700 medida no woff2 que o build embarca: advanceWidth
// 600/1000 = 0,6em. Arredondado para 0,62em — pior caso tolerado (a mono do
// sistema, que entra como fallback, também fica em ~0,6em). O <pre> herda 16px.
const AVANCO_EM = 0.62;
const FONTE_PX = 16;
// Coluna útil em 320px: 320 − 2×24 (o `px-6` do PageShell).
const COLUNA_UTIL_PX = 272;

const fonte = readFileSync(fileURLToPath(new URL("./ascii.ts", import.meta.url)), "utf8");

describe("orçamento de largura da arte ASCII (FR-010)", () => {
  it("AC-005: toda linha cabe nos 272px da coluna em 320px", () => {
    for (const [nome, arte] of Object.entries(ARTES)) {
      expect(arte.length, `${nome} não pode estar vazia`).toBeGreaterThan(0);

      const larguraColunas = Math.max(...arte.map((linha) => linha.length));
      const larguraPx = larguraColunas * AVANCO_EM * FONTE_PX;

      expect(
        larguraPx,
        `${nome}: ${larguraColunas} colunas = ${larguraPx.toFixed(1)}px > ${COLUNA_UTIL_PX}px`,
      ).toBeLessThanOrEqual(COLUNA_UTIL_PX);
    }
  });

  it("AC-005: a arte não usa tabulação (quebraria a matemática de coluna)", () => {
    // O `\t` renderiza com largura variável na maioria das monospace, então o
    // orçamento de colunas deixaria de valer. Varre a fonte crua para pegar
    // também um tab escrito fora dos arrays.
    expect(fonte).not.toContain("\t");
  });
});
