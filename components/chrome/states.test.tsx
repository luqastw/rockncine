import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `next/font/google` só é necessário por causa do `global-error.tsx`, que
// redeclara as fontes do documento que ele substitui. Fora do build do Next não
// faz sentido baixar nada, então vira stub.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "font-inter" }),
  Space_Mono: () => ({ variable: "--font-space-mono", className: "font-space-mono" }),
}));

import NotFound from "@/app/not-found";
import SegmentError from "@/app/error";
import GlobalError from "@/app/global-error";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Os dois boundaries logam no console por design; aqui isso só polui a saída.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  cleanup();
});

/**
 * A linguagem dos estados (FR-019): fio (`--hairline`), arte ASCII decorativa
 * (`<pre aria-hidden>`) e a marca acessível fora da arte.
 */
function assertLinguagemDoEstado(container: HTMLElement) {
  expect(container.querySelector('[class*="hairline"]')).toBeTruthy();
  expect(container.querySelector('pre[aria-hidden="true"]')).toBeTruthy();

  const marca = screen.getByText("rockncine");
  expect(marca.closest('[aria-hidden="true"]')).toBeNull();
}

describe("estados de erro (FR-019)", () => {
  it("AC-016: o 404 exibe fio e arte ASCII decorativa, com a marca fora da arte", () => {
    const { container } = render(<NotFound />);
    assertLinguagemDoEstado(container);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("página não encontrada");
  });

  it("AC-016: o erro de segmento exibe fio e arte ASCII decorativa", () => {
    const { container } = render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    assertLinguagemDoEstado(container);
  });

  it("AC-016: o erro global (documento inteiro) usa a mesma linguagem", () => {
    const { container } = render(<GlobalError error={new Error("boom")} retry={() => {}} />);
    assertLinguagemDoEstado(container);
  });
});

describe("hierarquia de controle nos estados (FR-020)", () => {
  it("AC-013: o CTA primário do erro é o bloco invertido", () => {
    render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    const primario = screen.getByRole("button", { name: "tentar de novo" });
    expect(primario.className).toContain("bg-[var(--invert-bg)]");
    expect(primario.className).toContain("text-[var(--invert-fg)]");
    expect(primario.className).toContain("focus:ring-[var(--outline-strong)]");

    const secundario = screen.getByRole("link", { name: "voltar pro menu" });
    expect(secundario.className).toContain("border-[var(--ink-muted)]");
  });

  it("AC-014: os alvos de toque do erro de segmento têm 44px", () => {
    render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    for (const botao of screen.getAllByRole("button")) {
      expect(botao.className).toContain("min-h-11");
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });

  it("AC-014: o botão do erro global tem 44px", () => {
    render(<GlobalError error={new Error("boom")} retry={() => {}} />);
    expect(screen.getByRole("button", { name: "tentar de novo" }).className).toContain("min-h-11");
  });
});
