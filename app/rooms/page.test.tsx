import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` porque as factories de `vi.mock` são içadas acima dos `const`:
// sem isto, a referência a `findMany` dentro da factory explode antes da
// inicialização.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { roomMember: { findMany } } }));
// Os três são client components com hooks próprios (next-auth/react,
// useRouter): irrelevantes para o que este teste verifica.
vi.mock("@/components/JoinRoomForm", () => ({ JoinRoomForm: () => null }));
vi.mock("@/components/CreateRoomForm", () => ({ CreateRoomForm: () => null }));
vi.mock("@/components/SignOutButton", () => ({ SignOutButton: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { getServerSession } from "next-auth";
import RoomsPage from "./page";

const memberships = [
  {
    joinedAt: new Date("2026-01-02T00:00:00Z"),
    room: { code: "MINHA123", name: "minha sala", ownerId: "eu" },
  },
  {
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    room: { code: "DELES456", name: "sala deles", ownerId: "outra-pessoa" },
  },
];

beforeEach(() => {
  findMany.mockReset();
  vi.mocked(getServerSession).mockReset();
});

describe("lista de salas — botão de exclusão (FR-001, FR-002)", () => {
  it("AC-008: existe exatamente um botão, dentro do item da sala do próprio usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue(memberships);

    render(await RoomsPage());

    const botoes = screen.getAllByText("excluir sala");
    expect(botoes).toHaveLength(1);

    const itemProprio = screen.getByRole("link", { name: /minha sala/i }).closest("li");
    const itemAlheio = screen.getByRole("link", { name: /sala deles/i }).closest("li");

    expect(itemProprio?.textContent).toContain("excluir sala");
    expect(itemAlheio?.textContent).not.toContain("excluir sala");
  });

  it("não renderiza botão nenhum quando o usuário não é dono de nenhuma sala", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu" } } as never);
    findMany.mockResolvedValue([
      {
        joinedAt: new Date("2026-01-01T00:00:00Z"),
        room: { code: "DELES456", name: "sala deles", ownerId: "outra-pessoa" },
      },
    ]);

    render(await RoomsPage());

    expect(screen.queryByText("excluir sala")).toBeNull();
    expect(screen.getByRole("link", { name: /sala deles/i })).toBeTruthy();
  });

  it("mantém cada botão como irmão do link, nunca aninhado (HTML válido)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([memberships[0]]);

    render(await RoomsPage());

    const link = screen.getByRole("link", { name: /minha sala/i });
    expect(link.querySelector("button")).toBeNull();

    const item = link.closest("li");
    expect(item?.querySelector("button")?.textContent).toBe("excluir sala");
  });
});
