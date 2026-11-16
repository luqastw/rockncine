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
import { redirect } from "next/navigation";
import Home from "@/app/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import NotFound from "@/app/not-found";
import RoomsPage from "@/app/rooms/page";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { modalPanelClass } from "@/components/ui/Modal";

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

describe("landing", () => {
  it("AC-006: um h1, header com entrar e criar conta, ol com três passos e footer", async () => {
    anon();
    render(await Home());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Assista junto, no mesmo instante",
    );
    expect(screen.getAllByRole("link", { name: "Entrar" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login");
    expect(screen.getAllByRole("link", { name: "Criar conta" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Começar agora" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Já tenho conta" }).getAttribute("href")).toBe("/login");
    expect(document.querySelectorAll("header")).toHaveLength(1);
    const ol = document.querySelector("ol");
    expect(ol?.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(document.querySelectorAll("footer")).toHaveLength(1);
  });

  it("AC-007: com sessão redireciona para /rooms", async () => {
    vi.mocked(redirect).mockClear();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu" } } as never);
    await Home();
    expect(redirect).toHaveBeenCalledWith("/rooms");
  });

  it("AC-008: sem controles de player falsos", async () => {
    anon();
    const { container } = render(await Home());
    expect(container.querySelector('[role="slider"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("AC-021: pauta no hero e névoa são aria-hidden", async () => {
    anon();
    const { container } = render(await Home());
    const hero = screen.getByRole("heading", { level: 1 }).closest("section");
    const pauta = hero?.querySelector("svg[data-lit]");
    expect(pauta?.getAttribute("aria-hidden")).toBe("true");
    expect(pauta?.querySelectorAll("[data-staff-line]").length).toBeGreaterThan(0);
    const nevoa = container.querySelector("[data-fog]");
    expect(nevoa?.getAttribute("aria-hidden")).toBe("true");
    expect(nevoa?.querySelector("svg")).not.toBeNull();
  });

  it("o CTA primário usa inversão e foco; o secundário usa contorno", async () => {
    anon();
    render(await Home());

    const primario = screen.getByRole("link", { name: "Começar agora" });
    expect(primario.className).toContain("bg-[var(--leaf)]");
    expect(primario.className).toContain("text-[var(--bg-void)]");
    expect(primario.className).toContain("reticle");

    const secundario = screen.getByRole("link", { name: "Já tenho conta" });
    expect(secundario.className).toContain("border-[var(--line-strong)]");
  });

  it("NFR-2: os alvos de toque da landing têm 44px", async () => {
    anon();
    render(await Home());
    assertAlvosDeToque();
  });
});

describe("superfícies em escopo — alvos de toque (FR-021)", () => {
  it("NFR-2: /login", () => {
    render(<LoginPage />);
    assertAlvosDeToque();
  });

  it("NFR-2: /register", () => {
    render(<RegisterPage />);
    assertAlvosDeToque();
  });

  it("NFR-2: /rooms", async () => {
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

  it("NFR-2: 404", () => {
    render(<NotFound />);
    assertAlvosDeToque();
  });
});

describe("primitivos de identidade", () => {
  it("AC-004: Card e Modal usam a moldura chanfrada", () => {
    render(<Card data-testid="card">x</Card>);
    render(<Card data-testid="card-primary" tone="primary">x</Card>);
    expect(screen.getByTestId("card").className.split(" ")).toContain("frame");
    expect(screen.getByTestId("card-primary").className.split(" ")).toContain("frame");
    expect(modalPanelClass.split(" ")).toContain("frame");
  });

  it("Modal: overlay rola e o painel não tem overflow nem altura máxima", async () => {
    const { modalOverlayClass } = await import("@/components/ui/Modal");
    expect(modalOverlayClass).toContain("overflow-y-auto");
    expect(modalOverlayClass).toContain("[align-items:safe_center]");
    expect(modalOverlayClass).not.toContain("items-center ");
    expect(modalPanelClass).not.toContain("overflow-y-auto");
    expect(modalPanelClass).not.toContain("max-h-");
  });

  it("variant danger não carrega classes de cor concorrentes", () => {
    render(<Button variant="danger">apagar</Button>);
    const botao = screen.getByRole("button", { name: "apagar" });
    expect(botao.className).toContain("text-[var(--heart)]");
    expect(botao.className).not.toContain("text-[var(--ink");
    expect(botao.className).not.toContain("border-[var(--line");
    expect(botao.getAttribute("data-variant")).toBeNull();
    expect(botao.className.split(" ")).not.toContain("frame-btn");
  });

  it("botão primário usa reticle-on-leaf", () => {
    render(<Button>ir</Button>);
    expect(screen.getByRole("button", { name: "ir" }).className.split(" ")).toContain("reticle-on-leaf");
  });

  it("AC-004: botão primário usa frame-btn e data-variant", () => {
    render(<Button>ir</Button>);
    const botao = screen.getByRole("button", { name: "ir" });
    expect(botao.className.split(" ")).toContain("frame-btn");
    expect(botao.getAttribute("data-variant")).toBe("primary");
  });

  it("AC-007: IconButton é circular e tem 44px", () => {
    render(<IconButton aria-label="x" />);
    const classes = screen.getByRole("button", { name: "x" }).className.split(" ");
    expect(classes).toContain("btn-round");
    expect(classes).toContain("min-h-11");
    expect(classes).toContain("min-w-11");
  });
});
