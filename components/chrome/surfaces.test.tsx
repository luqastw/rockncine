import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de app/rooms/page.test.tsx: as factories de `vi.mock` são içadas,
// então o mock de prisma precisa de `vi.hoisted` para o `vi.fn` existir antes.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { roomMember: { findMany } } }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
// Client components com hooks próprios — fora do que estas asserções cobrem.
vi.mock("@/components/LoginForm", () => ({ LoginForm: () => null }));
vi.mock("@/components/RegisterForm", () => ({ RegisterForm: () => null }));
vi.mock("@/components/JoinRoomForm", () => ({ JoinRoomForm: () => null }));
vi.mock("@/components/CreateRoomForm", () => ({ CreateRoomForm: () => null }));
vi.mock("@/components/SignOutButton", () => ({ SignOutButton: () => null }));

import { getServerSession } from "next-auth";
import Home from "@/app/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import NotFound from "@/app/not-found";
import RoomsPage from "@/app/rooms/page";

beforeEach(() => {
  findMany.mockReset();
  vi.mocked(getServerSession).mockReset();
});

function anon() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

/**
 * Todo alvo de toque novo tem 44px (AC-014, FR-021): cada <button> e cada link
 * de navegação precisa de `min-h-11`. Links inline de texto (dentro de um <p>)
 * são isentos — é a exceção do WCAG 2.5.5 que o app já usa no "cadastrar".
 */
function assertAlvosDeToque() {
  for (const botao of screen.queryAllByRole("button")) {
    expect(botao.className, `botão "${botao.textContent}"`).toContain("min-h-11");
  }
  const links = screen.queryAllByRole("link").filter((link) => !link.closest("p"));
  for (const link of links) {
    expect(link.className, `link "${link.textContent}"`).toContain("min-h-11");
  }
}

describe("landing (FR-017)", () => {
  it("AC-011: marca no h1, CTA para /register e /login, e o ol com três passos", async () => {
    anon();
    render(await Home());

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("rockncine");
    expect(screen.getByRole("link", { name: "criar conta" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "já tenho conta" }).getAttribute("href")).toBe("/login");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("AC-013: o CTA primário usa inversão e foco; o secundário usa contorno", async () => {
    anon();
    render(await Home());

    const primario = screen.getByRole("link", { name: "criar conta" });
    expect(primario.className).toContain("bg-[var(--invert-bg)]");
    expect(primario.className).toContain("text-[var(--invert-fg)]");
    expect(primario.className).toContain("focus:ring-[var(--outline-strong)]");
    expect(primario.className).toContain("ring-offset-[var(--focus-offset)]");

    const secundario = screen.getByRole("link", { name: "já tenho conta" });
    expect(secundario.className).toContain("border-[var(--ink-muted)]");
  });

  it("AC-014: os alvos de toque da landing têm 44px", async () => {
    anon();
    render(await Home());
    assertAlvosDeToque();
  });
});

describe("superfícies em escopo — alvos de toque (FR-021)", () => {
  it("AC-014: /login", () => {
    render(<LoginPage />);
    assertAlvosDeToque();
  });

  it("AC-014: /register", () => {
    render(<RegisterPage />);
    assertAlvosDeToque();
  });

  it("AC-014: /rooms", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([
      {
        joinedAt: new Date(),
        room: {
          code: "MINHA123",
          name: "minha sala",
          ownerId: "eu",
          videoSource: "YOUTUBE",
          updatedAt: new Date(),
        },
      },
    ]);

    render(await RoomsPage({ searchParams: Promise.resolve({}) }));
    assertAlvosDeToque();
  });

  it("AC-014: /404", () => {
    render(<NotFound />);
    assertAlvosDeToque();
  });
});
