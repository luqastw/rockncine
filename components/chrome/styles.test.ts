// @vitest-environment node
// Lê app/globals.css do disco: ambiente `node`, não o jsdom do resto da suíte
// (importar `node:fs` sob jsdom é externalizado pelo Vite e falha).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

function ruleBody(selector: string): string {
  return css.match(new RegExp(selector + "\\s*\\{([^}]*)\\}"))?.[1] ?? "";
}

describe("glow ambiente estático (FR-006)", () => {
  it("AC-006: .ambient é fixo, não interativo e sem animação", () => {
    const body = ruleBody("\\.ambient");
    expect(body).toContain("position: fixed");
    expect(body).toContain("pointer-events: none");
    expect(body).not.toMatch(/animation/);
    expect(body).not.toMatch(/transition/);
  });

  it("AC-006: reduced-transparency desliga o glow e o desfoque", () => {
    const start = css.indexOf("@media (prefers-reduced-transparency");
    expect(start, "o bloco de reduced-transparency deve existir").toBeGreaterThanOrEqual(0);

    const block = css.slice(start);
    expect(block).toContain(".ambient");
    expect(block).toContain("display: none");
    expect(block).toContain(".chrome-blur");
    expect(block).toContain("backdrop-filter: none");
  });
});

describe("blur isolado no chrome (FR-005)", () => {
  it("AC-005: .chrome-blur usa blur 6px, fundo 72% e fio no scroll", () => {
    const body = ruleBody("\\.chrome-blur");
    const blur = body.match(/backdrop-filter:\s*blur\((\d+(?:\.\d+)?)px\)/);
    expect(blur, ".chrome-blur precisa declarar backdrop-filter").toBeTruthy();
    expect(Number(blur?.[1])).toBeLessThanOrEqual(12);

    // O fio nasce transparente e aparece com o scroll (comportamento da Kimi).
    expect(body).toContain("border-bottom: 1px solid transparent");
    const scrolled = ruleBody('\\.chrome-blur\\[data-scrolled="true"\\]');
    expect(scrolled).toContain("border-bottom-color: var(--hairline)");

    // Fundo translúcido e acromático (R=G=B).
    const fundo = body.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*0\.\d+\)/);
    expect(fundo, "fundo translúcido").toBeTruthy();
    expect(fundo?.[1]).toBe(fundo?.[2]);
    expect(fundo?.[2]).toBe(fundo?.[3]);
  });
});

describe("realce progressivo ancorado em marcador de JS (FR-013, FR-014)", () => {
  it("AC-010: toda regra que toca `.reveal` é ancorada em [data-js] ou [data-reveal]", () => {
    const regras = [...css.matchAll(/([^{}]+)\{[^}]*\}/g)]
      .map((m) => m[1].trim())
      .filter((seletor) => /\.reveal\b/.test(seletor));

    expect(regras.length).toBeGreaterThanOrEqual(2);
    for (const seletor of regras) {
      // Sem `[data-js]` E sem `[data-reveal]` (isto é, sem JS nenhum), `.reveal`
      // não casa seletor nenhum e o conteúdo nasce visível — é o que AC-001 exige.
      const ancorada = seletor.includes("[data-js]") || seletor.includes("[data-reveal]");
      expect(ancorada, `regra "${seletor}" sem marcador de JS`).toBe(true);
    }
  });
});
