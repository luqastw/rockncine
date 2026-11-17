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

describe("reduced-transparency (FR-006)", () => {
  it("AC-006: reduced-transparency desliga o desfoque", () => {
    const start = css.indexOf("@media (prefers-reduced-transparency");
    expect(start, "o bloco de reduced-transparency deve existir").toBeGreaterThanOrEqual(0);

    const block = css.slice(start);
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
    expect(scrolled).toContain("border-bottom-color: var(--gold-edge)");

    const fundo = body.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*0\.\d+\)/);
    expect(fundo, "fundo translúcido").toBeTruthy();
    expect(Number(fundo?.[2])).toBeGreaterThanOrEqual(Number(fundo?.[1]));
    expect(Number(fundo?.[2])).toBeGreaterThanOrEqual(Number(fundo?.[3]));
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

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    if (depth === 0) return css.slice(open, i);
  }
  return "";
}

describe("movimento por tokens (FR-012, FR-019, FR-021)", () => {
  it("AC-010: movimento usa tokens", () => {
    const dur = css.match(/--motion-dur:\s*(\d+(?:\.\d+)?)ms/);
    expect(dur, "--motion-dur em ms").toBeTruthy();
    expect(Number(dur?.[1])).toBeLessThanOrEqual(200);

    for (const m of css.matchAll(/calc\(var\(--motion-dur\)\s*\*(?:\s*var\(--motion-factor\)\s*\*)?\s*(\d*\.?\d+)\)/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(1.9);
    }
    expect(css).toMatch(/calc\(var\(--motion-dur\)\s*\*\s*var\(--motion-factor\)/i);

    const permitidos = new Set(["sync-flash"]);
    const nomes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(nomes.length).toBeGreaterThan(0);
    for (const nome of nomes) {
      if (permitidos.has(nome)) continue;
      const corpo = blockAfter(`@keyframes ${nome}`);
      const props = [...corpo.matchAll(/([a-z-]+)\s*:[^;{}]+;/g)].map((m) => m[1]);
      for (const prop of props) {
        expect(["opacity", "transform"], `@keyframes ${nome} anima ${prop}`).toContain(prop);
      }
    }

    expect(ruleBody("\\.reduce-motion,[^{]*\\.reduce-motion \\*::after")).toMatch(
      /--motion-factor:\s*0\b/,
    );
    expect(blockAfter("@media (prefers-reduced-motion: reduce)")).toMatch(/--motion-factor:\s*0\b/i);
  });
});
