import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { getServerSession } from "next-auth";
import Home from "@/app/page";

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(null);
});

// O gate do CSS (`[data-js] .reveal`) é verificado em styles.test.ts, no ambiente
// node — aqui o alvo é o DOM renderizado.

describe("realce progressivo (FR-013, FR-014)", () => {
  it("AC-002: sem IntersectionObserver nenhuma seção nasce oculta", async () => {
    const original = window.IntersectionObserver;
    Reflect.deleteProperty(window, "IntersectionObserver");

    render(await Home());

    const reveals = document.querySelectorAll(".reveal");
    expect(reveals.length).toBeGreaterThan(0);
    reveals.forEach((el) => {
      expect(el.hasAttribute("data-visible"), "toda seção nasca visível").toBe(true);
    });

    if (original !== undefined) window.IntersectionObserver = original;
  });

  it("AC-002: com um IntersectionObserver que nunca dispara, o wrapper não nasce visível", async () => {
    // Controle do teste acima: com IO presente é ele (e não o fallback) que decide
    // revelar — prova que a asserção anterior exercita o caminho de fallback.
    const original = window.IntersectionObserver;
    const stub = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    window.IntersectionObserver = stub;

    render(await Home());
    const reveals = document.querySelectorAll(".reveal");
    expect(reveals.length).toBeGreaterThan(0);
    expect([...reveals].every((el) => !el.hasAttribute("data-visible"))).toBe(true);

    if (original !== undefined) window.IntersectionObserver = original;
    else Reflect.deleteProperty(window, "IntersectionObserver");
  });

  it("o conteúdo da landing é renderizado dentro dos wrappers (o portão de AC-001 é o CSS, em styles.test.ts)", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("rockncine");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
