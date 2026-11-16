// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

vi.mock("@/lib/prisma", () => ({
  prisma: { profileImage: { findUnique: mocks.findUnique } },
}));

import { GET } from "./route";

const BASE_URL = "http://localhost:3000";
const BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);
const OLD = new Date("2026-01-01T00:00:00.000Z");
const NEW = new Date("2026-02-01T00:00:00.000Z");

function call(userId: string, query = "") {
  return GET(new Request(`${BASE_URL}/api/avatar/${userId}${query}`), {
    params: Promise.resolve({ userId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerSession.mockResolvedValue({ user: { id: "viewer" } });
  mocks.findUnique.mockResolvedValue({ data: BYTES, updatedAt: NEW });
});

describe("GET /api/avatar/[userId]", () => {
  it("retorna 401 sem sessão e não consulta o banco", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await call("alvo");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Não autenticado." });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each(["..", "a b", "a".repeat(65)])("retorna 404 no-store para userId inválido %#", async (id) => {
    const res = await call(id);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("retorna 404 no-store sem imagem", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await call("alvo");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("retorna imagem immutable quando v é a versão atual", async () => {
    const res = await call("alvo", `?v=${NEW.getTime()}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(Buffer.from(await res.arrayBuffer()).equals(BYTES)).toBe(true);
  });

  it("retorna no-store quando v difere da versão atual", async () => {
    const res = await call("alvo", `?v=${OLD.getTime()}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["", "?v=abc", "?v=0"])("retorna no-store sem v válido %#", async (query) => {
    const res = await call("alvo", query);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("apenas a versão atual é immutable entre duas versões", async () => {
    const oldUrl = `?v=${OLD.getTime()}`;
    const newUrl = `?v=${NEW.getTime()}`;
    expect(oldUrl).not.toBe(newUrl);

    const stale = await call("alvo", oldUrl);
    const fresh = await call("alvo", newUrl);
    expect(stale.headers.get("Cache-Control")).toBe("no-store");
    expect(fresh.headers.get("Cache-Control")).toContain("immutable");

    mocks.findUnique.mockResolvedValue({ data: BYTES, updatedAt: OLD });
    const olderCurrent = await call("alvo", oldUrl);
    expect(olderCurrent.headers.get("Cache-Control")).toContain("immutable");
  });

  it("qualquer usuário logado lê a imagem de outro userId", async () => {
    const res = await call("outro-usuario", `?v=${NEW.getTime()}`);
    expect(res.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId: "outro-usuario" },
      select: { data: true, updatedAt: true },
    });
  });
});
