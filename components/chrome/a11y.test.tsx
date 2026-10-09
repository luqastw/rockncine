import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsciiArt } from "./AsciiArt";
import { GrainOverlay } from "./GrainOverlay";
import { HERO_ART } from "./ascii";

describe("camada de grão (FR-007)", () => {
  it("AC-006: o nó é decorativo — aria-hidden e classe .grain", () => {
    // A ausência de animation/transition e o `pointer-events: none` vivem no CSS:
    // são verificados em styles.test.ts (ambiente node, onde ler arquivo não é
    // externalizado pelo jsdom). Aqui se prova o que é do DOM renderizado.
    const { container } = render(<GrainOverlay />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.className).toContain("grain");
  });
});

describe("arte ASCII decorativa (FR-009)", () => {
  it("AC-007: renderiza um <pre aria-hidden> com a arte dentro, fora da árvore de acessibilidade", () => {
    const { container } = render(<AsciiArt art={HERO_ART} />);
    const pre = container.querySelector("pre");

    expect(pre).toBeTruthy();
    expect(pre?.getAttribute("aria-hidden")).toBe("true");
    // O nó desenha a arte de verdade — um <pre> vazio passaria pelo `aria-hidden`
    // sem entregar nada.
    expect(pre?.textContent).toBe(HERO_ART.join("\n"));
  });
});
