import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AmbientGlow } from "./AmbientGlow";
import { Wordmark } from "./Wordmark";

describe("glow ambiente (FR-006)", () => {
  it("AC-006: o nó é decorativo — aria-hidden e classe .ambient", () => {
    // A ausência de animation/transition e o `pointer-events: none` vivem no CSS:
    // são verificados em styles.test.ts (ambiente node, onde ler arquivo não é
    // externalizado pelo jsdom). Aqui se prova o que é do DOM renderizado.
    const { container } = render(<AmbientGlow />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.className).toContain("ambient");
  });
});

describe("wordmark (FR-007)", () => {
  it("AC-007: o texto é acessível e o ponto à esquerda é decorativo", () => {
    const { container } = render(<Wordmark />);

    const marca = screen.getByText("rockncine");
    expect(marca.closest('[aria-hidden="true"]')).toBeNull();
    expect(marca.className).toContain("bg-clip-text");

    const decorativo = container.querySelector('[aria-hidden="true"]');
    expect(decorativo).toBeTruthy();
    expect(decorativo?.textContent).toBe("");
  });
});
