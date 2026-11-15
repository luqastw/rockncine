import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "font-inter" }),
  Fraunces: () => ({ variable: "--font-fraunces", className: "font-fraunces" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "font-geist-mono" }),
}));

import NotFound from "@/app/not-found";
import SegmentError from "@/app/error";
import GlobalError from "@/app/global-error";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  cleanup();
});

function assertLinguagemDoEstado(container: HTMLElement) {
  expect(container.querySelector("[data-staff-line]")).toBeTruthy();

  const marca = screen.getByText("rockncine");
  expect(marca.closest('[aria-hidden="true"]')).toBeNull();
}

describe("estados de erro (FR-007)", () => {
  it("AC-019: o 404 exibe a pauta, com a marca acessível", () => {
    const { container } = render(<NotFound />);
    assertLinguagemDoEstado(container);
  });

  it("AC-019: o 404 tem o h1 e o link de volta ao começo", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("você voltou ao mesmo lugar");
    expect(screen.getByRole("link", { name: "voltar ao começo" }).getAttribute("href")).toBe("/");
  });

  it("o erro de segmento exibe a pauta", () => {
    const { container } = render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    assertLinguagemDoEstado(container);
  });

  it("o erro global (documento inteiro) usa a mesma linguagem", () => {
    const { container } = render(<GlobalError error={new Error("boom")} retry={() => {}} />);
    assertLinguagemDoEstado(container);
  });
});

describe("hierarquia de controle nos estados (FR-020)", () => {
  it("o CTA primário do erro é o bloco invertido", () => {
    render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    const primario = screen.getByRole("button", { name: "tentar de novo" });
    expect(primario.className).toContain("bg-[var(--leaf)]");
    expect(primario.className).toContain("text-[var(--bg-void)]");
    expect(primario.className).toContain("focus-visible:ring-[var(--outline-strong)]");

    const secundario = screen.getByRole("link", { name: "voltar pro menu" });
    expect(secundario.className).toContain("border-[var(--line-strong)]");
  });

  it("NFR-2: os alvos de toque do erro de segmento têm 44px", () => {
    render(<SegmentError error={new Error("boom")} reset={() => {}} />);
    for (const botao of screen.getAllByRole("button")) {
      expect(botao.className).toContain("min-h-11");
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });

  it("NFR-2: o botão do erro global tem 44px", () => {
    render(<GlobalError error={new Error("boom")} retry={() => {}} />);
    expect(screen.getByRole("button", { name: "tentar de novo" }).className).toContain("min-h-11");
  });
});
