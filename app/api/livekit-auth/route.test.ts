// @vitest-environment node
// Ambiente `node`, e não o jsdom do resto da suíte: `AccessToken.toJwt()` assina
// com `jose`, que valida o payload com `instanceof Uint8Array` — sob jsdom a
// classe global diverge da do realm do módulo e a assinatura estoura por um
// motivo que não tem nada com a rota. A rota não toca no DOM.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";

// `vi.hoisted` porque as factories de `vi.mock` são içadas acima dos `const`:
// sem isto, a referência a `findUnique` dentro da factory explode antes da
// inicialização.
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  roomFindUnique: vi.fn(),
  roomMemberFindUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: { findUnique: mocks.roomFindUnique },
    roomMember: { findUnique: mocks.roomMemberFindUnique },
  },
}));

import { POST } from "./route";
import { LIVEKIT_TOKEN_TTL } from "@/lib/livekit";

const USER_ID = "user-1";
const OTHER_ID = "user-2";
const CODE = "7KQ2M9XA";
const ROOM_ID = "room-1";
const API_KEY = "APIteste";
const API_SECRET = "segredo-de-teste-do-servidor-livekit-rockncine";

// O token é lido decodificando o payload, sem `jose` nem `jsonwebtoken`: o
// teste quer verificar o que a rota AFIRMA (o grant), não o que o SDK assina.
// Verificar a assinatura exigiria a chave — que é justamente o que o servidor
// guarda. Três partes separadas por ponto, o payload é o segundo.
type Claims = {
  sub?: string;
  name?: string;
  nbf?: number;
  exp?: number;
  video?: Record<string, unknown>;
};

async function claimsOf(response: Response): Promise<Claims> {
  const [, payload] = (await response.text()).split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
}

const ORIGINAL_ENV = { ...process.env };

let rooms: { id: string; code: string }[];
let members: { roomId: string; userId: string }[];

function callPost(body: unknown, raw?: string) {
  return POST(
    new Request("http://localhost:3000/api/livekit-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LIVEKIT_API_KEY = API_KEY;
  process.env.LIVEKIT_API_SECRET = API_SECRET;

  rooms = [{ id: ROOM_ID, code: CODE }];
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
  mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID, name: "ana" } });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/livekit-auth", () => {
  it("AC-007: sem sessão, 401 e nenhum token emitido", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await callPost({ room: CODE });

    expect(response.status).toBe(401);
    // Nenhuma leitura de banco: a autorização não chegou a ser avaliada.
    expect(mocks.roomFindUnique).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("eyJ");
  });

  it("AC-008: não-membro, 403 e nenhum token emitido", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: OTHER_ID, name: "bruno" } });

    const response = await callPost({ room: CODE });

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("eyJ");
  });

  it("sala inexistente, 404", async () => {
    const response = await callPost({ room: "NAOEXISTE" });

    expect(response.status).toBe(404);
    // A membership é consultada só depois de confirmar que a sala existe.
    expect(mocks.roomMemberFindUnique).not.toHaveBeenCalled();
  });

  it("room ausente ou não-string, 400", async () => {
    expect((await callPost({})).status).toBe(400);
    expect((await callPost({ room: 42 })).status).toBe(400);
    expect((await callPost({ room: "" })).status).toBe(400);
    expect(mocks.roomFindUnique).not.toHaveBeenCalled();
  });

  // Corpo que não é JSON não pode virar 500: a status de verdade é 400.
  it("corpo malformado, 400 em vez de exceção", async () => {
    const response = await callPost(null, "{ não é json");

    expect(response.status).toBe(400);
  });

  // Degradação: sem chave e segredo no deploy, a rota recusa explicitamente
  // (503) em vez de estourar ao assinar. O cliente trata como "transmissão
  // indisponível" e a sala segue no modo player.
  it("sem credencial do Livekit, 503 e nenhum banco consultado", async () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    const response = await callPost({ room: CODE });

    expect(response.status).toBe(503);
    expect(mocks.roomFindUnique).not.toHaveBeenCalled();
  });

  it("membro recebe 200 e um token de room com publicar e assinar", async () => {
    const response = await callPost({ room: CODE });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/jwt");

    const claims = await claimsOf(response);
    // FR-020: room nomeada com o código da sala, e a identidade é o mesmo
    // `userId` que o `ScreenSharePlayer` casa com `broadcasterId`.
    expect(claims.video).toMatchObject({
      room: CODE,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    expect(claims.sub).toBe(USER_ID);
    expect(claims.name).toBe("ana");
  });

  // Não-objetivo da spec: o estado de transmissão mora no storage do
  // Liveblocks, então data channel é uma segunda fonte de verdade para o mesmo
  // fato. Fechado no grant, não por convenção.
  it("o token não abre data channel nem gravação", async () => {
    const response = await callPost({ room: CODE });

    const video = (await claimsOf(response)).video ?? {};
    expect(video.canPublishData).toBe(false);
    expect(video.roomRecord ?? false).toBe(false);
    expect(video.roomAdmin ?? false).toBe(false);
  });

  it("o token expira no prazo declarado", async () => {
    const before = Math.floor(Date.now() / 1000);
    const claims = await claimsOf(await callPost({ room: CODE }));

    // `2h` em string — o SDK converte com o parser de time span dele, então o
    // contrato testado é o número de segundos, não a string. O SDK emite
    // `nbf`/`exp` e não `iat`, então a janela é medida a partir de `nbf`.
    expect(Number(claims.nbf)).toBeGreaterThanOrEqual(before);
    expect(Number(claims.exp) - Number(claims.nbf)).toBe(7200);
    expect(LIVEKIT_TOKEN_TTL).toBe("2h");
  });

  // A room do Livekit é nomeada com o código, e o par é o que torna a
  // autorização auditável. Uma sala de outro código não pode receber token
  // apontando para a room de uma sala que a pessoa não é membro.
  it("o token só cita a sala pedida", async () => {
    rooms.push({ id: "room-2", code: "OUTRA123" });
    members.push({ roomId: "room-2", userId: USER_ID });

    const claims = await claimsOf(await callPost({ room: "OUTRA123" }));

    expect(claims.video?.room).toBe("OUTRA123");
  });

  // O teste acima lê o payload decodificado, o que não prova nada sobre a
  // assinatura. Este verifica o token QUE A ROTA EMITIU com o verificador do
  // próprio SDK: é o mesmo caminho que o servidor do Livekit faz antes de
  // deixar alguém entrar na room. Se a chave ou o formato do token divergissem,
  // o botão de transmitir seria um botão inerte para todo mundo.
  it("o token emitido é aceito pelo verificador do SDK (a assinatura confere)", async () => {
    const response = await callPost({ room: CODE });

    const claims = await new TokenVerifier(API_KEY, API_SECRET).verify(await response.text());

    // O verificador devolve o grant aninhado em `video` e a identidade em `sub`
    // — é o formato que o servidor do Livekit lê, então testá-lo nested é o que
    // pega um grant escrito no lugar errado.
    expect(claims.video).toMatchObject({
      room: CODE,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    expect(claims.sub).toBe(USER_ID);
    expect(claims.iss).toBe(API_KEY);
  });

  it("sessão sem id não autentica (o id é a identidade do token)", async () => {
    mocks.getServerSession.mockResolvedValue({ user: {} });

    expect((await callPost({ room: CODE })).status).toBe(401);
  });
});
