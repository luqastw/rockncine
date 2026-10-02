import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  roomFindUnique: vi.fn(),
  roomUpdate: vi.fn(),
  roomMemberFindUnique: vi.fn(),
  resolveVideoUrl: vi.fn(),
  resetBuckets: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: { findUnique: mocks.roomFindUnique, update: mocks.roomUpdate },
    roomMember: { findUnique: mocks.roomMemberFindUnique },
  },
}));

vi.mock("@/lib/video-source", () => ({ resolveVideoUrl: mocks.resolveVideoUrl }));

// O rate limit vive em estado de módulo e vazaria entre casos — `resetRateLimitBuckets`
// é a válvula de escape que `lib/rate-limit.ts` expõe justamente para os testes.
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, resetRateLimitBuckets: mocks.resetBuckets };
});

import { PATCH } from "./route";
import { resetRateLimitBuckets } from "@/lib/rate-limit";

const USER_ID = "user-1";
const OTHER_ID = "user-2";
const CODE = "7KQ2M9XA";
const ROOM_ID = "room-1";
const BASE_URL = "http://localhost:3000";

type FakeRoom = { id: string; code: string; videoSource: string | null; embedUrl: string | null };

let rooms: FakeRoom[];
let members: { roomId: string; userId: string }[];

function callPatch(
  code: string,
  body: unknown,
  options: { origin?: string; ip?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.ip !== undefined) headers.set("x-forwarded-for", options.ip);

  const request = new Request(`${BASE_URL}/rooms/${code}/video`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ code }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitBuckets();

  rooms = [{ id: ROOM_ID, code: CODE, videoSource: null, embedUrl: null }];
  members = [{ roomId: ROOM_ID, userId: USER_ID }];

  mocks.roomFindUnique.mockImplementation(
    async ({ where }: { where: { code: string } }) =>
      rooms.find((room) => room.code === where.code) ?? null,
  );
  mocks.roomMemberFindUnique.mockImplementation(
    async ({ where }: { where: { roomId_userId: { roomId: string; userId: string } } }) =>
      members.find(
        (member) =>
          member.roomId === where.roomId_userId.roomId &&
          member.userId === where.roomId_userId.userId,
      ) ?? null,
  );
  mocks.roomUpdate.mockImplementation(async ({ data }: { data: Partial<FakeRoom> }) => {
    Object.assign(rooms[0], data);
    return rooms[0];
  });
  mocks.resolveVideoUrl.mockResolvedValue({
    source: "YOUTUBE",
    embedUrl: "dQw4w9WgXcQ",
    sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
});

describe("PATCH /rooms/[code]/video", () => {
  it("membro recebe 200 e o vídeo é persistido", async () => {
    const response = await callPatch(CODE, { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rooms[0]).toMatchObject({
      videoSource: "YOUTUBE",
      embedUrl: "dQw4w9WgXcQ",
    });
  });

  it("sem sessão: 401 e nada é escrito", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await callPatch(CODE, { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" });

    expect(response.status).toBe(401);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  it("não-membro: 403 e nada é escrito", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: OTHER_ID } });

    const response = await callPatch(CODE, { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" });

    expect(response.status).toBe(403);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  it("sala inexistente: 404", async () => {
    const response = await callPatch("NAOEXISTE", { sourceUrl: "https://youtu.be/x" });

    expect(response.status).toBe(404);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  it("link inválido: 400 e nada é escrito", async () => {
    mocks.resolveVideoUrl.mockResolvedValue(null);

    const response = await callPatch(CODE, { sourceUrl: "não é uma url" });

    expect(response.status).toBe(400);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  // A rota aceita SÓ `sourceUrl`: `source`/`embedUrl` do cliente são
  // re-derivados no servidor, senão dava para persistir um `data:text/html,...`
  // que ia direto pro `iframe src` de quem reabrisse a sala.
  it("ignora source/embedUrl enviados pelo cliente", async () => {
    await callPatch(CODE, {
      sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
      source: "GENERIC_IFRAME",
      embedUrl: "data:text/html,<h1>x</h1>",
    });

    expect(mocks.roomUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          videoSource: "YOUTUBE",
          embedUrl: "dQw4w9WgXcQ",
          videoSourceUrl: "https://youtu.be/dQw4w9WgXcQ",
        },
      }),
    );
  });

  it("payload sem sourceUrl: 400", async () => {
    const response = await callPatch(CODE, { foo: "bar" });

    expect(response.status).toBe(400);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  // A rota de escrita sem checagem de origem: um site terceiro com form POST
  // (ou fetch com content-type não-simples) alcançava a escrita na conta de
  // quem clicasse no link.
  it("Origin de outro host: 403, sem chegar na sessão", async () => {
    const response = await callPatch(
      CODE,
      { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" },
      { origin: "https://exemplo.invalido" },
    );

    expect(response.status).toBe(403);
    expect(mocks.getServerSession).not.toHaveBeenCalled();
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  it("Origin com o host da requisição segue", async () => {
    const response = await callPatch(
      CODE,
      { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" },
      { origin: BASE_URL },
    );

    expect(response.status).toBe(200);
  });

  // `resolveVideoUrl` faz fetch de saída (oEmbed do Vimeo). `/api/resolve-embed`
  // limita a 30/min; esta rota chega na mesma operação por um caminho que
  // estava sem limite — um membro autenticado em laço virava amplificador
  // contra o Vimeo.
  it("rate limit corta a abuso depois de 20 requisições no minuto", async () => {
    const ip = "203.0.113.7";
    let limited: Response | null = null;

    for (let i = 0; i < 21; i++) {
      const response = await callPatch(
        CODE,
        { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" },
        { ip },
      );
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited).not.toBeNull();
    expect(limited!.headers.get("retry-after")).toBeTruthy();

    // a 21ª é barrada ANTES da resolução e da escrita: as 20 primeiras
    // passaram, então o que se mede aqui é que a tentativa barrada não chegou
    // a `resolveVideoUrl` nem ao `room.update`.
    mocks.resolveVideoUrl.mockClear();
    mocks.roomUpdate.mockClear();

    const barrada = await callPatch(CODE, { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" }, { ip });

    expect(barrada.status).toBe(429);
    expect(mocks.resolveVideoUrl).not.toHaveBeenCalled();
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
  });

  it("o limite é por origem, não global", async () => {
    const primeiro = "203.0.113.1";
    for (let i = 0; i < 21; i++) {
      await callPatch(CODE, { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" }, { ip: primeiro });
    }

    const outro = await callPatch(
      CODE,
      { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" },
      { ip: "203.0.113.2" },
    );

    expect(outro.status).toBe(200);
  });
});
