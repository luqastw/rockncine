import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Wordmark } from "./Wordmark";

describe("wordmark (FR-007)", () => {
  it("AC-007: o texto é acessível e o ponto à esquerda é decorativo", () => {
    const { container } = render(<Wordmark />);

    const marca = screen.getByText("Rockncine");
    expect(marca.closest('[aria-hidden="true"]')).toBeNull();
    expect(marca.className).toContain("text-[var(--ink)]");

    const decorativo = container.querySelector('[aria-hidden="true"]');
    expect(decorativo).toBeTruthy();
    expect(decorativo?.textContent).toBe("");
  });
});
