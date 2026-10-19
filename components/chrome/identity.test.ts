// @vitest-environment node
// Lê app/globals.css do disco: precisa do ambiente `node`, e não do jsdom do
// resto da suíte (mesmo padrão de docs/specs/anchors.test.ts).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssBruto = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

// Comentários fora: eles citam contrastes medidos e nomes de spec, e uma
// palavra em português poderia colidir com o denylist.
const css = cssBruto.replace(/\/\*[\s\S]*?\*\//g, "");

// Tokens legados preservados (FR-002 / AC-010 da spec 15, herdados das specs
// 01 e 13) + a camada nova de superfícies e fills.
const TOKENS = [
  "bg-void",
  "bg-surface",
  "bg-elevated",
  "line",
  "ink",
  "ink-muted",
  "fill-1",
  "fill-2",
  "fill-3",
  "hairline",
  "invert-bg",
  "invert-fg",
  "outline-strong",
  "id-1",
  "id-2",
  "id-3",
  "id-4",
  "scrim",
  "focus-offset",
];

type Cor = { origem: string; r: number; g: number; b: number };

function hexParaRgb(digits: string): [number, number, number] {
  const full = digits.length <= 4 ? digits.split("").map((d) => d + d).join("") : digits;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * TODO literal de cor do arquivo — dentro de variável OU de bloco de regra
 * (a porta dos fundos que o scan só-de-variável deixava passar, ex.: o fundo do
 * `.chrome-blur`). `url(data:...)` é removido antes.
 */
function literaisDeCor(arquivo: string): Cor[] {
  const semDataUri = arquivo.replace(/url\(["']?data:[^)]*\)/gi, "");
  const cores: Cor[] = [];

  for (const m of semDataUri.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
    const digits = m[1];
    if (![3, 4, 6, 8].includes(digits.length)) continue;
    const [r, g, b] = hexParaRgb(digits);
    cores.push({ origem: `#${digits}`, r, g, b });
  }

  for (const m of semDataUri.matchAll(/rgba?\(([^)]+)\)/gi)) {
    const parts = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      cores.push({ origem: `rgb(${m[1]})`, r: parts[0], g: parts[1], b: parts[2] });
    }
  }

  return cores;
}

describe("identidade neutra (FR-001)", () => {
  it("AC-001: todo literal de cor do arquivo tem R=G=B", () => {
    const cores = literaisDeCor(css);

    // O coletor não pode estar quebrado: sem este piso, a asserção abaixo
    // passaria por vacuidade se a regex parasse de achar cor nenhuma.
    expect(cores.length).toBeGreaterThanOrEqual(10);

    const infractores = cores
      .filter(({ r, g, b }) => !(r === g && g === b))
      .map(({ origem, r, g, b }) => `${origem} → rgb(${r},${g},${b})`);

    expect(infractores).toEqual([]);
  });

  it("AC-001: nenhum hsl() com saturação, nenhum nome de cor cromático", () => {
    const hslComCor = [...css.matchAll(/hsla?\(([^)]+)\)/gi)]
      .map((m) => m[1].trim())
      .filter((args) => {
        const sat = args.split(/[\s,/]+/)[1] ?? "0";
        return parseFloat(sat) !== 0;
      });
    expect(hslComCor).toEqual([]);

    const nomeCromatico =
      /\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|teal|lime|navy|maroon|olive|aqua|fuchsia)\b/i;
    expect(nomeCromatico.test(css), "cor nomeada cromática no globals.css").toBe(false);

    // Funções de cor que carregam croma e não passam por hex/rgb/hsl.
    const funcaoDeCroma = /\b(oklch|oklab|lch|lab|hwb|color)\(/i;
    expect(funcaoDeCroma.test(css), "função de cor fora do scan").toBe(false);
  });

  it("AC-002: os tokens legados e os novos continuam declarados", () => {
    const nomes = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
    const faltando = TOKENS.filter((token) => !nomes.has(token));
    expect(faltando).toEqual([]);
  });
});
