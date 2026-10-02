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

const HOJE = new Date();

function diasAtras(n: number) {
  return new Date(HOJE.getTime() - n * 86_400_000);
}

function membership(over: Partial<{ code: string; name: string | null; ownerId: string; videoSource: string | null; updatedAt: Date }> = {}) {
  return {
    joinedAt: diasAtras(10),
    room: {
      code: "MINHA123",
      name: "minha sala",
      ownerId: "eu",
      videoSource: "YOUTUBE",
      updatedAt: diasAtras(1),
      ...over,
    },
  };
}

const PAGE_SIZE = 20;

beforeEach(() => {
  findMany.mockReset();
  vi.mocked(getServerSession).mockReset();
});

// `RoomsPage` é um async server component: o render consome a promise antes de
// devolver os elementos, senão o `findMany` ainda não rodou quando a asserção
// é avaliada.
async function renderPage(pagina?: string) {
  return render(await RoomsPage({ searchParams: Promise.resolve(pagina ? { pagina } : {}) }));
}

describe("lista de salas — botão de exclusão (FR-001, FR-002)", () => {
  it("AC-008: existe exatamente um botão, dentro do item da sala do próprio usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([
      membership(),
      membership({ code: "DELES456", name: "sala deles", ownerId: "outra-pessoa" }),
    ]);

    await renderPage();

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
      membership({ code: "DELES456", name: "sala deles", ownerId: "outra-pessoa" }),
    ]);

    await renderPage();

    expect(screen.queryByText("excluir sala")).toBeNull();
    expect(screen.getByRole("link", { name: /sala deles/i })).toBeTruthy();
  });

  it("mantém cada botão como irmão do link, nunca aninhado (HTML válido)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage();

    const link = screen.getByRole("link", { name: /minha sala/i });
    expect(link.querySelector("button")).toBeNull();

    const item = link.closest("li");
    expect(item?.querySelector("button")?.textContent).toBe("excluir sala");
  });
});

describe("ordem e metadados da lista", () => {
  // Ordenar por `membership.joinedAt` punia as salas que importam: alguém que
  // entrou há meses e está rolando agora aparecia no fim. `room.updatedAt` é
  // o proxy mais próximo de atividade que o modelo atual permite.
  it("ordena por updatedAt da sala, não por quando o usuário entrou", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { room: { updatedAt: "desc" } } }),
    );
  });

  it("mostra a fonte do vídeo no card", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership({ videoSource: "VIMEO" })]);

    await renderPage();

    expect(screen.getByRole("link", { name: /vimeo/i })).toBeTruthy();
  });

  it("sem vídeo carregado, mostra só o código — sem separador pendurado", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership({ videoSource: null })]);

    await renderPage();

    // A linha do código é a segunda do card; o `·` separador só existe quando
    // há fonte. ("sua · " no canto é outro rótulo, por isso o alvo é o span.)
    const linha = screen.getByText(/MINHA123/);
    expect(linha.textContent).toBe("MINHA123");
  });

  it("usa data relativa para hoje e ontem", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([
      membership({ code: "HOJE123", name: "sala de hoje", updatedAt: new Date() }),
      membership({ code: "ONTEM12", name: "sala de ontem", updatedAt: diasAtras(1) }),
    ]);

    await renderPage();

    expect(screen.getByRole("link", { name: /sala de hoje/i }).textContent).toContain("hoje");
    expect(screen.getByRole("link", { name: /sala de ontem/i }).textContent).toContain("ontem");
  });
});

describe("paginação", () => {
  // O `take: 20` fixo sem nenhuma saída fazia a 21ª sala sumir sem aviso.
  it("pede uma página a mais para detectar se há próxima", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([]);

    await renderPage();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: PAGE_SIZE + 1, skip: 0 }),
    );
  });

  it("mostra 'mais' quando existe página seguinte e esconde o item extra", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue(
      Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
        membership({ code: `SALA${String(i).padStart(4, "0")}`, name: `sala ${i}` }),
      ),
    );

    await renderPage();

    expect(screen.getByRole("link", { name: /mais →/i })).toBeTruthy();
    // o item 21 existe na resposta e serve só de sinal — não é renderizado
    expect(screen.getByRole("link", { name: /sala 19/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sala 20/i })).toBeNull();
  });

  it("não mostra navegação quando cabe tudo numa página", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage();

    expect(screen.queryByRole("navigation", { name: /páginas de salas/i })).toBeNull();
  });

  it("página 2 volta com skip e mostra 'anteriores'", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage("2");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: PAGE_SIZE, take: PAGE_SIZE + 1 }),
    );
    expect(screen.getByRole("link", { name: /← anteriores/i })).toBeTruthy();
    expect(screen.getByText("página 2")).toBeTruthy();
  });

  // `Number.parseInt("abc")` é `NaN` e `Number.parseInt("-3")` é negativo:
  // sem a guarda, `skip` seria `NaN` e o Prisma jogaria.
  it("página inválida cai na primeira", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage("abc");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it("página negativa cai na primeira", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([membership()]);

    await renderPage("-3");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });
});
