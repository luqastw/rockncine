import { beforeEach, describe, expect, it, vi } from "vitest";

// As fábricas de `vi.mock` são içadas acima dos imports, então os spies precisam
// ser criados em `vi.hoisted` para já existirem quando elas rodarem.
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  roomFindFirst: vi.fn(),
  roomDelete: vi.fn(),
  roomMemberDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: { findFirst: mocks.roomFindFirst, delete: mocks.roomDelete },
    roomMember: { deleteMany: mocks.roomMemberDeleteMany },
    $transaction: mocks.transaction,
  },
}));

// Import relativo: o diretório chama-se `[code]` e o alias `@/` com colchetes no
// caminho é risco desnecessário.
import { DELETE } from "./route";

const OWNER_ID = "user-dono";
const OTHER_ID = "user-terceiro";
const CODE = "7KQ2M9XA";
const ROOM_ID = "room-1";
const BASE_URL = "http://localhost:3000";

type FakeRoom = { id: string; code: string; ownerId: string };
type FakeMember = { roomId: string; userId: string };

let rooms: FakeRoom[];
let members: FakeMember[];

function callDelete(code: string, options: { origin?: string } = {}) {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);

  const request = new Request(`${BASE_URL}/api/rooms/${code}`, { method: "DELETE", headers });
  return DELETE(request, { params: Promise.resolve({ code }) });
}

beforeEach(() => {
  vi.clearAllMocks();

  rooms = [{ id: ROOM_ID, code: CODE, ownerId: OWNER_ID }];
  members = [
    { roomId: ROOM_ID, userId: OWNER_ID },
    { roomId: ROOM_ID, userId: OTHER_ID },
    { roomId: ROOM_ID, userId: "user-3" },
  ];

  // `where.OR` é lido como igualdade exata de `code` — exatamente o que a rota
  // manda. Se ela passasse a usar `contains`/`mode: "insensitive"` (curinga), a
  // busca não acharia a sala e os casos de sucesso falhariam.
  mocks.roomFindFirst.mockImplementation(
    async (args: { where: { OR?: { code?: string }[] } }) =>
      rooms.find((room) =>
        (args.where.OR ?? []).some(
          (clause) => clause.code !== undefined && clause.code === room.code,
        ),
      ) ?? null,
  );

  mocks.roomMemberDeleteMany.mockImplementation(
    async ({ where }: { where: { roomId: string } }) => {
      const before = members.length;
      members = members.filter((member) => member.roomId !== where.roomId);
      return { count: before - members.length };
    },
  );

  mocks.roomDelete.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const index = rooms.findIndex((room) => room.id === where.id);
    return rooms.splice(index, 1)[0];
  });

  mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );

  mocks.getServerSession.mockResolvedValue({ user: { id: OWNER_ID } });
});

describe("DELETE /api/rooms/[code]", () => {
  it("AC-001 [FR-008] sem sessão: 401 e nenhuma linha de Room/RoomMember muda", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const roomsBefore = rooms.length;
    const membersBefore = members.length;

    const response = await callDelete(CODE);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);

    expect(rooms.length).toBe(roomsBefore);
    expect(members.length).toBe(membersBefore);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("AC-002 [FR-009] autenticado que não é dono: 403 e a sala continua existindo", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: OTHER_ID } });
    members = [];

    const response = await callDelete(CODE);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(rooms.some((room) => room.code === CODE)).toBe(true);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("AC-003 [FR-009] não-dono que é RoomMember: 403 e a membership continua existindo", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: OTHER_ID } });

    const response = await callDelete(CODE);

    expect(response.status).toBe(403);
    expect(members.some((member) => member.userId === OTHER_ID)).toBe(true);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("AC-004 [FR-010] código inexistente: 404", async () => {
    const response = await callDelete("NAOEXISTE");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("AC-005 [FR-011] Origin de outro host: 403 e a sala continua existindo", async () => {
    const response = await callDelete(CODE, { origin: "https://exemplo.invalido" });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(rooms.some((room) => room.code === CODE)).toBe(true);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
    // Ordem exigida: `Origin` é checado antes da sessão.
    expect(mocks.getServerSession).not.toHaveBeenCalled();
  });

  it("AC-006 [FR-012] dono: 200 com { ok: true }, 0 RoomMember e sem linha de Room", async () => {
    const response = await callDelete(CODE);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(members.filter((member) => member.roomId === ROOM_ID)).toHaveLength(0);
    expect(rooms.some((room) => room.id === ROOM_ID)).toBe(false);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    // `RoomMember` precisa ser removido antes do `Room` (FK `NO ACTION`).
    expect(mocks.roomMemberDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.roomDelete.mock.invocationCallOrder[0],
    );
  });

  it("AC-007 [FR-012] repetir a exclusão com a mesma sessão: 404", async () => {
    const first = await callDelete(CODE);
    expect(first.status).toBe(200);

    const second = await callDelete(CODE);

    expect(second.status).toBe(404);
    expect(mocks.roomDelete).toHaveBeenCalledTimes(1);
    expect(mocks.roomMemberDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("ordem exigida: sessão é checada antes da existência da sala", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await callDelete("NAOEXISTE");

    expect(response.status).toBe(401);
    expect(mocks.roomFindFirst).not.toHaveBeenCalled();
  });

  it("FR-011: Origin com o host da requisição segue para a exclusão", async () => {
    const response = await callDelete(CODE, { origin: BASE_URL });

    expect(response.status).toBe(200);
    expect(rooms.some((room) => room.code === CODE)).toBe(false);
  });

  it("busca tolerante a caixa: código em minúsculas acha a sala", async () => {
    const response = await callDelete(CODE.toLowerCase());

    expect(response.status).toBe(200);
    expect(mocks.roomFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ code: CODE.toLowerCase() }, { code: CODE.toUpperCase() }] },
      }),
    );
  });

  it("curinga da URL não vira curinga de busca: '%' responde 404", async () => {
    const response = await callDelete("%");

    expect(response.status).toBe(404);
    expect(mocks.roomDelete).not.toHaveBeenCalled();
    expect(mocks.roomMemberDeleteMany).not.toHaveBeenCalled();
  });
});
