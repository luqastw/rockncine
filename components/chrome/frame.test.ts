// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function escapar(seletor: string): string {
  return seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bloco(seletor: string): string {
  const re = new RegExp(`(?:^|[}\\s,])${escapar(seletor)}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[1]).join("\n");
}

describe("superfícies e foco do pergaminho", () => {
  it("AC-004: moldura chanfrada", () => {
    const frame = bloco(".frame");
    expect(frame).toMatch(/clip-path:\s*polygon\([^;]*var\(--clip\)/i);
    expect(bloco(".frame::before")).toMatch(/clip-path:\s*polygon\([^;]*calc\(var\(--clip\) - 1px\)/i);
    expect(bloco(".frame::after")).toMatch(/inset:\s*3px/i);
    expect(bloco(".frame-btn")).toMatch(/clip-path:\s*polygon\([^;]*var\(--clip\)/i);
    const clip = Number(css.match(/--clip:\s*(\d+)px/)?.[1]);
    expect(clip).toBeGreaterThanOrEqual(6);
    expect(clip).toBeLessThanOrEqual(8);
  });

  it("AC-005: orçamento de pergaminho", () => {
    const parchment = bloco(".parchment");
    expect(parchment).toMatch(/background:\s*var\(--parchment\)/i);
    expect(parchment).toMatch(/color:\s*var\(--parchment-ink\)/i);
    expect(parchment).toMatch(/--line:\s*var\(--parchment-edge\)/i);
    const grao = bloco(".parchment::before");
    expect(grao).toMatch(/feTurbulence/i);
    expect(grao).toMatch(/pointer-events:\s*none/i);
    const opacidade = Number(grao.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(opacidade).toBeGreaterThan(0);
    expect(opacidade).toBeLessThanOrEqual(0.03);
    expect(bloco('.parchment [data-variant="primary"]')).toMatch(
      /border:\s*1px solid var\(--parchment-ink\)/,
    );
  });

  it("AC-006: foco por mira", () => {
    const reticle = bloco(".reticle");
    expect(reticle).toMatch(/outline:\s*none/i);
    expect(reticle).toMatch(/position:\s*relative/i);
    const foco = bloco(".reticle:focus-visible::after");
    expect((foco.match(/linear-gradient/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(foco).toMatch(/var\(--fairy\)/i);
    expect(foco).not.toMatch(/outline:\s*(?!none)/i);
    expect(bloco(".parchment .reticle:focus-visible::after")).toMatch(/var\(--parchment-ink\)/i);

    const campo = bloco(".field-ring");
    expect(campo).toMatch(/outline:\s*none/i);
    expect(bloco(".field-ring:focus-visible")).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--fairy\)/i);
    expect(bloco(".parchment .field-ring:focus-visible")).toMatch(
      /box-shadow:\s*inset 0 0 0 2px var\(--parchment-ink\)/,
    );
  });

  it("AC-007: botão circular", () => {
    const round = bloco(".btn-round");
    expect(round).toMatch(/border-radius:\s*50%/i);
    expect(round).toMatch(/min-width:\s*44px/i);
    expect(round).toMatch(/min-height:\s*44px/i);
  });

  it("foco sobre fundo folha usa mira escura com contraste >= 3", () => {
    expect(bloco(".reticle.reticle-on-leaf:focus-visible::after")).toMatch(
      /--reticle:\s*var\(--bg-void\)/,
    );
    const luz = (hex: string) => {
      const canais = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
    };
    const [a, b] = [luz("#0f1a14"), luz("#5f9e4f")].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(3);
  });

  it("mira do input sr-only e anel externo do pergaminho com moldura", () => {
    expect(bloco(".peer:focus-visible + .reticle-peer::after")).toMatch(/--reticle:\s*var\(--fairy\)/i);
    expect(bloco(".reticle-peer")).toMatch(/position:\s*relative/i);
    expect(bloco(".frame.parchment")).toMatch(/background:\s*var\(--line\)/i);
  });
});
