import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { findMany, findUnique, userFindUnique, roomCount, memberCount, requireSession, getServerSession } =
  vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  userFindUnique: vi.fn(),
  roomCount: vi.fn(),
  memberCount: vi.fn(),
  requireSession: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    roomMember: { findMany, count: memberCount },
    profileImage: { findUnique },
    user: { findUnique: userFindUnique },
    room: { count: roomCount },
  },
}));
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/components/SignOutButton", () => ({ SignOutButton: () => null }));
vi.mock("@/components/DeleteRoomButton", () => ({ DeleteRoomButton: () => null }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/font/google", () => ({
  Geologica: () => ({ variable: "--font-geologica", className: "font-geologica" }),
  Fraunces: () => ({ variable: "--font-fraunces", className: "font-fraunces" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "font-geist-mono" }),
}));

import Home from "@/app/page";
import NotFound from "@/app/not-found";
import ProfilePage from "@/app/profile/page";
import RoomsPage from "@/app/rooms/page";
import { Divider } from "./Divider";
import { Fog } from "./Fog";
import { Staff } from "./Staff";
import { Fairy } from "./Fairy";
import { Stump } from "./Stump";
import { Wordmark } from "./Wordmark";

function decorativos(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-motif]")]
    .filter((el) => el.getAttribute("data-motif") !== "product-preview")
    .filter((el) => el.closest('[aria-hidden="true"]') === null)
    .map((el) => el.getAttribute("data-motif") ?? "");
}

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

  it("AC-021: lit troca data-lit e acende o grupo de fada por opacidade", () => {
    const apagada = render(<Staff />);
    expect(apagada.container.querySelector("svg")?.getAttribute("data-lit")).toBe("false");
    expect(apagada.container.querySelector("[data-staff-note]")?.parentElement?.getAttribute("fill")).toBe(
      "var(--leaf-ink)",
    );
    expect(apagada.container.querySelector("[data-staff-fairy]")?.getAttribute("class")).toContain(
      "opacity-0",
    );
    apagada.unmount();

    const acesa = render(<Staff lit />);
    expect(acesa.container.querySelector("svg")?.getAttribute("data-lit")).toBe("true");
    const fada = acesa.container.querySelector("[data-staff-fairy]");
    expect(fada?.getAttribute("fill")).toBe("var(--fairy)");
    expect(fada?.getAttribute("class")).toContain("opacity-100");
    expect(fada?.getAttribute("class")).toContain("transition-opacity");
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

describe("divisor dourado (FR-019)", () => {
  it("AC-010: divisor é decorativo e marcado como motivo", () => {
    const { container } = render(<Divider />);
    const alvo = container.querySelector("[data-motif='divider']");

    expect(alvo?.getAttribute("aria-hidden")).toBe("true");
    expect(alvo?.className).toContain("divider-gold");
  });
});

describe("identidade de pergaminho (FR-010, FR-011)", () => {
  it("AC-009: marca é imagem decorativa", () => {
    const { container, getByText } = render(<Wordmark />);
    const marca = container.querySelector("img");

    expect(marca?.getAttribute("aria-hidden")).toBe("true");
    expect(marca?.getAttribute("alt")).toBe("");
    expect(marca?.getAttribute("src")).toContain("/brand/mark.png");
    expect(getByText("Rockncine")).toBeTruthy();
  });

  it("AC-008: motivos marcados", () => {
    expect(render(<Staff />).container.querySelector("[data-motif='staff']")).toBeTruthy();
    expect(render(<Fog />).container.querySelector("[data-motif='fog']")).toBeTruthy();
    expect(render(<Stump />).container.querySelector("[data-motif='stump']")).toBeTruthy();
    const fada = render(<Fairy />).container.querySelector("[data-motif='fairy']");
    expect(fada?.getAttribute("aria-hidden")).toBe("true");
    expect(fada?.getAttribute("alt")).toBe("");
  });

  it("AC-008: motivos da landing e do 404 são decorativos e dentro do orçamento", async () => {
    getServerSession.mockResolvedValue(null);
    const landing = render(await Home());
    expect(landing.container.querySelectorAll("[data-motif]").length).toBeLessThanOrEqual(8);
    expect(decorativos(landing.container)).toEqual([]);
    landing.unmount();

    const nf = render(<NotFound />);
    expect(nf.container.querySelectorAll("[data-motif]").length).toBeLessThanOrEqual(6);
    expect(decorativos(nf.container)).toEqual([]);
  });

  it("AC-008: motivos em /rooms e /profile dentro do orçamento, sem divisor sob o título", async () => {
    getServerSession.mockResolvedValue({ user: { id: "eu", name: "eu" } });
    requireSession.mockResolvedValue({ userId: "eu", userName: "eu" });
    findUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ email: "eu@example.com", createdAt: new Date() });
    roomCount.mockResolvedValue(0);
    memberCount.mockResolvedValue(0);

    findMany.mockResolvedValue([]);
    const vazia = render(await RoomsPage({ searchParams: Promise.resolve({}) }));
    expect(vazia.container.querySelectorAll("[data-motif]").length).toBeLessThanOrEqual(4);
    expect(decorativos(vazia.container)).toEqual([]);
    vazia.unmount();

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
    const cheia = render(await RoomsPage({ searchParams: Promise.resolve({}) }));
    expect(cheia.container.querySelectorAll("[data-motif]").length).toBeLessThanOrEqual(4);
    expect(decorativos(cheia.container)).toEqual([]);
    cheia.unmount();

    const perfil = render(await ProfilePage());
    expect(perfil.container.querySelector('[data-motif="divider"]')).toBeNull();
    expect(perfil.container.querySelectorAll("[data-motif]").length).toBeLessThanOrEqual(4);
    expect(decorativos(perfil.container)).toEqual([]);
  });
});
