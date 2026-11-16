import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "font-inter" }),
  Fraunces: () => ({ variable: "--font-fraunces", className: "font-fraunces" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "font-geist-mono" }),
}));

import Home from "@/app/page";
import RoomError from "@/app/rooms/[code]/error";
import RoomNotFound from "@/app/rooms/[code]/not-found";
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

function assertLinguagemDoEstado(container: HTMLElement, motivo = "[data-staff-line]") {
  expect(container.querySelector(motivo)).toBeTruthy();

  const marca = screen.getByText("Rockncine");
  expect(marca.closest('[aria-hidden="true"]')).toBeNull();
}

describe("estados de erro (FR-007)", () => {
  it("AC-019: o 404 exibe a fada, com a marca acessível", () => {
    const { container } = render(<NotFound />);
    assertLinguagemDoEstado(container, '[data-motif="fairy"]');
  });

  it("AC-019: o 404 tem o h1 e o link de volta ao começo", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Você voltou ao mesmo lugar");
    expect(screen.getByRole("link", { name: "Voltar ao começo" }).getAttribute("href")).toBe("/");
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
    const primario = screen.getByRole("button", { name: "Tentar de novo" });
    expect(primario.className).toContain("bg-[var(--leaf)]");
    expect(primario.className).toContain("text-[var(--bg-void)]");
    expect(primario.className).toContain("reticle");

    const secundario = screen.getByRole("link", { name: "Voltar pro menu" });
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
    expect(screen.getByRole("button", { name: "Tentar de novo" }).className).toContain("min-h-11");
  });
});

describe("landing e moldura dos estados (FR-013, FR-018)", () => {
  it("AC-011: landing", async () => {
    const { container } = render(await Home());

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const listas = container.querySelectorAll("ol");
    expect(listas).toHaveLength(1);
    expect(listas[0].querySelectorAll(":scope > li")).toHaveLength(3);
    expect(container.querySelector('[role="slider"]')).toBeNull();
    expect(container.querySelector('[class*="grid-cols-3"]')).toBeNull();
  });

  it("AC-019/FR-018: estados de erro dentro de moldura", () => {
    const casos = [
      <NotFound key="a" />,
      <SegmentError key="b" error={new Error("boom")} reset={() => {}} />,
      <GlobalError key="c" error={new Error("boom")} retry={() => {}} />,
      <RoomNotFound key="d" />,
      <RoomError key="e" error={new Error("boom")} retry={() => {}} />,
    ];
    for (const caso of casos) {
      const { container, unmount } = render(caso);
      expect(container.querySelector("h1")?.closest(".frame")).toBeTruthy();
      unmount();
    }
  });
});
