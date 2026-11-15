import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Fog } from "./Fog";
import { Staff } from "./Staff";
import { Stump } from "./Stump";

describe("motivos (FR-008, FR-009)", () => {
  it("AC-021: pauta é decorativa com cinco linhas", () => {
    const { container } = render(<Staff />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(container.querySelectorAll("[data-staff-line]")).toHaveLength(5);
  });

  it("AC-021: número de notas respeita o intervalo de 3 a 6", () => {
    const baixo = render(<Staff notes={2} />);
    expect(baixo.container.querySelectorAll("[data-staff-note]")).toHaveLength(3);
    baixo.unmount();

    const alto = render(<Staff notes={9} />);
    expect(alto.container.querySelectorAll("[data-staff-note]")).toHaveLength(6);
    alto.unmount();

    const padrao = render(<Staff />);
    expect(padrao.container.querySelectorAll("[data-staff-note]")).toHaveLength(4);
  });

  it("AC-021: lit troca data-lit e a cor das notas", () => {
    const apagada = render(<Staff />);
    expect(apagada.container.querySelector("svg")?.getAttribute("data-lit")).toBe("false");
    expect(apagada.container.querySelector("[data-staff-note]")?.getAttribute("fill")).toBe(
      "var(--leaf-ink)",
    );
    apagada.unmount();

    const acesa = render(<Staff lit />);
    expect(acesa.container.querySelector("svg")?.getAttribute("data-lit")).toBe("true");
    expect(acesa.container.querySelector("[data-staff-note]")?.getAttribute("fill")).toBe(
      "var(--fairy)",
    );
  });

  it("AC-021: névoa é decorativa, estática e tem três caminhos", () => {
    const { container } = render(<Fog />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("path")).toHaveLength(3);
    expect(container.innerHTML).not.toMatch(/animat/i);
    expect(container.firstElementChild?.className).toContain("pointer-events-none");
  });

  it("toco é decorativo", () => {
    const { container } = render(<Stump />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });
});
