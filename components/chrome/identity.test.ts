// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssBruto = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);
const layout = readFileSync(
  fileURLToPath(new URL("../../app/layout.tsx", import.meta.url)),
  "utf8",
);

const css = cssBruto.replace(/\/\*[\s\S]*?\*\//g, "");

const PALETA = [
  "#0f1a14",
  "#16241c",
  "#1d2e24",
  "#2a3a2c",
  "#6b7f68",
  "#e8e2cc",
  "#a8ad98",
  "#5f9e4f",
  "#7bb86a",
  "#d9a441",
  "#bfe6ff",
  "#000000",
  "#e8dfc2",
  "#2a2417",
  "#c9bd96",
  "#f0cf7a",
  "#a87a2a",
  "#e07a6e",
  "#8f2a22",
];

const TOKENS_EXATOS: Record<string, string> = {
  "bg-void": "#0f1a14",
  "bg-surface": "#16241c",
  "bg-elevated": "#1d2e24",
  line: "#2a3a2c",
  hairline: "#2a3a2c",
  "line-strong": "#6b7f68",
  ink: "#e8e2cc",
  "ink-muted": "#a8ad98",
  leaf: "#5f9e4f",
  "leaf-ink": "#7bb86a",
  torch: "var(--gold)",
  fairy: "#bfe6ff",
  parchment: "#e8dfc2",
  "parchment-ink": "#2a2417",
  "parchment-edge": "#c9bd96",
  "gold-hi": "#f0cf7a",
  gold: "#d9a441",
  "gold-lo": "#a87a2a",
  heart: "#e07a6e",
  clip: "20px",
  "clip-lg": "32px",
  "clip-btn": "12px",
  rail: "72px",
  "ease-reveal": "cubic-bezier(0, 0, 0.58, 1)",
  "ease-menu": "cubic-bezier(0.73, 0.42, 0.52, 0.703)",
  "dur-reveal": "800ms",
  "dur-menu": "500ms",
  "dur-menu-item": "300ms",
  "stagger-reveal": "200ms",
  "stagger-menu": "70ms",
  "motion-dur": "200ms",
  "motion-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
  "motion-factor": "1",
};

const TOKENS_LEGADOS = [
  "fill-1",
  "fill-2",
  "fill-3",
  "invert-bg",
  "invert-fg",
  "outline-strong",
  "focus-offset",
  "scrim",
  "id-1",
  "id-2",
  "id-3",
  "id-4",
];

function hexParaCanais(digits: string): string {
  const full = digits.length <= 4 ? digits.split("").map((d) => d + d).join("") : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
}

const CANAIS_DA_PALETA = new Set(PALETA.map((hex) => hexParaCanais(hex.slice(1))));

function literaisForaDaPaleta(arquivo: string): { total: number; fora: string[] } {
  const semDataUri = arquivo.replace(/url\(["']?data:[^)]*\)/gi, "");
  const fora: string[] = [];
  let total = 0;

  for (const m of semDataUri.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
    total += 1;
    if (!PALETA.includes(`#${m[1].toLowerCase()}`)) fora.push(`#${m[1]}`);
  }

  for (const m of semDataUri.matchAll(/rgba?\(([^)]+)\)/gi)) {
    total += 1;
    const [cor, alfa] = m[1].split("/").map((parte) => parte.trim());
    const canais = cor.split(/[\s,]+/).filter(Boolean).slice(0, 3).join(" ");
    if (!CANAIS_DA_PALETA.has(canais) || alfa === undefined) fora.push(`rgb(${m[1]})`);
  }

  return { total, fora };
}

function valorDoToken(nome: string): string | undefined {
  const m = css.match(new RegExp(`--${nome}\\s*:\\s*([^;]+);`));
  return m?.[1].trim().toLowerCase();
}

describe("identidade Lost Woods", () => {
  it("AC-001: literais de cor pertencem ao conjunto", () => {
    const { total, fora } = literaisForaDaPaleta(css);
    expect(total).toBeGreaterThanOrEqual(10);
    expect(fora).toEqual([]);
  });

  it("sem hsl() com saturação e sem cor nomeada fora da paleta", () => {
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

    const funcaoDeCroma = /\b(oklch|oklab|lch|lab|hwb|color)\(/i;
    expect(funcaoDeCroma.test(css), "função de cor fora do scan").toBe(false);
  });

  it("AC-002: declara os tokens da identidade pergaminho", () => {
    const divergentes = Object.entries(TOKENS_EXATOS)
      .filter(([nome, valor]) => valorDoToken(nome) !== valor)
      .map(([nome]) => nome);
    expect(divergentes).toEqual([]);
  });

  it("AC-002: legados do FR-002 declarados e ligados à paleta", () => {
    const nomes = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
    expect(TOKENS_LEGADOS.filter((token) => !nomes.has(token))).toEqual([]);
    expect(valorDoToken("invert-bg")).toBe("var(--leaf)");
    expect(valorDoToken("invert-fg")).toBe("var(--bg-void)");
    expect(valorDoToken("outline-strong")).toBe("var(--fairy)");
  });

  it("AC-022: layout carrega Fraunces e --font-display a referencia", () => {
    expect(layout).toMatch(/Fraunces[\s\S]*from "next\/font\/google"/i);
    expect(layout).toContain('variable: "--font-fraunces"');
    expect(layout).toContain("fraunces.variable");
    expect(valorDoToken("font-display")).toContain("var(--font-fraunces)");
  });

  it("tipografia: Fraunces com eixos orgânicos e Geologica no corpo", () => {
    expect(layout).toContain('axes: ["SOFT", "WONK", "opsz"]');
    expect(layout).toContain('variable: "--font-geologica"');
    expect(valorDoToken("font-sans")).toContain("var(--font-geologica)");
    expect(css).toMatch(/"opsz"\s+144/);
    expect(css).toMatch(/"SOFT"\s+100/);
  });

  it("escala tipográfica: display 48 a 96px, h2 32 a 56px, cartão 24 a 32px", () => {
    expect(valorDoToken("text-display")).toMatch(/^clamp\(3rem,[^,]+,\s*6rem\)$/);
    expect(valorDoToken("text-h2")).toMatch(/^clamp\(2rem,[^,]+,\s*3\.5rem\)$/);
    expect(valorDoToken("text-card")).toMatch(/^clamp\(1\.5rem,[^,]+,\s*2rem\)$/);
  });

  it("título dourado em gradiente com recorte no texto", () => {
    expect(valorDoToken("gold-grad")).toContain("var(--gold-hi)");
    expect(valorDoToken("gold-grad")).toContain("var(--gold-lo)");
    expect(css).toMatch(/\.text-gold\s*\{[^}]*background-clip:\s*text/);
  });

  it("fundo em camadas: vinheta radial e treliça de losangos a no máximo 5%", () => {
    const corpo = css.match(/body::before\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(corpo).toContain("radial-gradient");
    expect(corpo).toContain("var(--lattice)");
    const opacidades = [...cssBruto.matchAll(/stroke-opacity='(0?\.\d+)'/g)].map((m) => Number(m[1]));
    expect(opacidades.length).toBeGreaterThan(0);
    for (const o of opacidades) expect(o).toBeLessThanOrEqual(0.05);
  });

  it("FR-006: themeColor do viewport", () => {
    expect(layout).toContain('themeColor: "#0f1a14"');
  });
});
