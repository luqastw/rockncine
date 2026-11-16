// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

vi.mock("@/lib/prisma", () => ({
  prisma: { profileImage: { upsert: mocks.upsert, deleteMany: mocks.deleteMany, findUnique: mocks.findUnique } },
}));

import { resetRateLimitBuckets } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/profile-image";
import { DELETE, GET, PUT } from "./route";

const USER_ID = "user-1";
const URL_ = "http://localhost:3000/api/profile/image";

const solid = (width: number, height: number, r = 200) =>
  sharp({
    create: { width, height, channels: 3, background: { r, g: 40, b: 90 } },
  });

function put(form: FormData, headers?: Record<string, string>) {
  return PUT(new Request(URL_, { method: "PUT", body: form, headers }));
}

function formWith(bytes: Uint8Array | Buffer, name: string, type: string) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitBuckets();
  mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.upsert.mockResolvedValue({ updatedAt: new Date(1_700_000_000_000) });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.findUnique.mockResolvedValue({ updatedAt: new Date(1_700_000_000_000) });
});

describe("PUT /api/profile/image", () => {
  it("401 sem sessão", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const png = await solid(300, 300).png().toBuffer();
    const res = await put(formWith(png, "a.png", "image/png"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Não autenticado." });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("PNG válido => 200 e upsert com WebP 256x256", async () => {
    const png = await solid(300, 500).png().toBuffer();
    const res = await put(formWith(png, "a.png", "image/png"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ v: 1_700_000_000_000 });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const args = mocks.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER_ID });
    expect(args.create.userId).toBe(USER_ID);
    const meta = await sharp(args.create.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
    expect(args.update.data).toBe(args.create.data);
  });

  it("ignora userId do corpo", async () => {
    const png = await solid(300, 300).png().toBuffer();
    const form = formWith(png, "a.png", "image/png");
    form.set("userId", "outro-usuario");
    const res = await put(form);
    expect(res.status).toBe(200);
    const args = mocks.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER_ID });
    expect(args.create.userId).toBe(USER_ID);
  });

  it("GIF com nome .png => 415", async () => {
    const gif = await solid(50, 50).gif().toBuffer();
    const res = await put(formWith(gif, "a.png", "image/png"));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "Formato de imagem não suportado." });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("SVG com type image/png => 415", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    const res = await put(formWith(svg, "a.png", "image/png"));
    expect(res.status).toBe(415);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("PNG truncado => 415", async () => {
    const png = await solid(300, 300).png().toBuffer();
    const res = await put(formWith(png.subarray(0, Math.floor(png.length / 2)), "a.png", "image/png"));
    expect(res.status).toBe(415);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("PNG 4097x100 => 415", async () => {
    const png = await solid(4097, 100).png().toBuffer();
    const res = await put(formWith(png, "a.png", "image/png"));
    expect(res.status).toBe(415);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("2_097_153 bytes => 413", async () => {
    const res = await put(formWith(new Uint8Array(MAX_UPLOAD_BYTES + 1), "a.jpg", "image/jpeg"));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Imagem muito grande (máx 2 MB)." });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("exatamente 2_097_152 bytes válido => 200", async () => {
    const png = await solid(300, 300).png().toBuffer();
    const padded = Buffer.concat([png, Buffer.alloc(MAX_UPLOAD_BYTES - png.length)]);
    expect(padded.length).toBe(MAX_UPLOAD_BYTES);
    const res = await put(formWith(padded, "a.png", "image/png"));
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("sem campo file => 400", async () => {
    const form = new FormData();
    form.set("file", "texto");
    const res = await put(form);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Envie uma imagem." });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("corpo não multipart => 400", async () => {
    const res = await PUT(new Request(URL_, { method: "PUT", body: "x" }));
    expect(res.status).toBe(400);
  });

  it("Content-Length enorme => 413", async () => {
    const png = await solid(50, 50).png().toBuffer();
    const res = await put(formWith(png, "a.png", "image/png"), {
      "content-length": String(MAX_UPLOAD_BYTES + 65_537),
    });
    expect(res.status).toBe(413);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  describe("limite de corpo sem Content-Length", () => {
    function streamOf(chunkSize: number, chunks: number, onCancel?: () => void) {
      let sent = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= chunks) {
            controller.close();
            return;
          }
          sent += 1;
          controller.enqueue(new Uint8Array(chunkSize));
        },
        cancel() {
          onCancel?.();
        },
      });
    }

    function streamed(body: ReadableStream<Uint8Array>, headers: Record<string, string>) {
      return PUT(new Request(URL_, { method: "PUT", body, headers, duplex: "half" } as RequestInit));
    }

    it("stream maior que o teto => 413, cancela e não processa", async () => {
      const cancel = vi.fn();
      const chunkSize = 65_536;
      const chunks = (MAX_UPLOAD_BYTES + 65_536) / chunkSize + 2;
      const res = await streamed(streamOf(chunkSize, chunks, cancel), {
        "content-type": "multipart/form-data; boundary=x",
      });
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: "Imagem muito grande (máx 2 MB)." });
      expect(cancel).toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("Content-Length mentindo para menos => 413", async () => {
      const chunkSize = 65_536;
      const res = await streamed(streamOf(chunkSize, (MAX_UPLOAD_BYTES + 65_536) / chunkSize + 2), {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": "100",
      });
      expect(res.status).toBe(413);
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("corpo chunked pequeno e válido => 200", async () => {
      const png = await solid(80, 80).png().toBuffer();
      const source = new Response(formWith(png, "a.png", "image/png"));
      const contentType = source.headers.get("content-type") ?? "";
      const bytes = new Uint8Array(await source.arrayBuffer());
      const half = Math.floor(bytes.length / 2);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.subarray(0, half));
          controller.enqueue(bytes.subarray(half));
          controller.close();
        },
      });
      const res = await streamed(body, { "content-type": contentType });
      expect(res.status).toBe(200);
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
    });
  });

  it("11ª chamada => 429 com retry-after e sem upsert", async () => {
    const png = await solid(50, 50).png().toBuffer();
    for (let i = 0; i < 10; i++) {
      const ok = await put(formWith(png, "a.png", "image/png"));
      expect(ok.status).toBe(200);
    }
    mocks.upsert.mockClear();
    const res = await put(formWith(png, "a.png", "image/png"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("segunda imagem faz upsert de novo", async () => {
    const a = await solid(100, 100, 10).png().toBuffer();
    const b = await solid(100, 100, 250).png().toBuffer();
    await put(formWith(a, "a.png", "image/png"));
    await put(formWith(b, "b.png", "image/png"));
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    const first = mocks.upsert.mock.calls[0][0].create.data;
    const second = mocks.upsert.mock.calls[1][0].create.data;
    expect(Buffer.compare(first, second)).not.toBe(0);
  });
});

describe("DELETE /api/profile/image", () => {
  it("401 sem sessão", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Não autenticado." });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("com imagem => 204 e deleteMany com o userId da sessão", async () => {
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("sem imagem => 204", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE();
    expect(res.status).toBe(204);
  });

  it("PUT e DELETE somam no mesmo bucket", async () => {
    const png = await solid(50, 50).png().toBuffer();
    for (let i = 0; i < 5; i++) {
      expect((await put(formWith(png, "a.png", "image/png"))).status).toBe(200);
      expect((await DELETE()).status).toBe(204);
    }
    mocks.upsert.mockClear();
    mocks.deleteMany.mockClear();

    const deleted = await DELETE();
    expect(deleted.status).toBe(429);
    expect(deleted.headers.get("retry-after")).toBeTruthy();
    expect(mocks.deleteMany).not.toHaveBeenCalled();

    const putRes = await put(formWith(png, "a.png", "image/png"));
    expect(putRes.status).toBe(429);
    expect(putRes.headers.get("retry-after")).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/profile/image", () => {
  it("401 sem sessão", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("com imagem => v com epoch ms", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ v: 1_700_000_000_000 });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { updatedAt: true },
    });
  });

  it("sem imagem => v null", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ v: null });
  });

  it("não consome rate limit", async () => {
    for (let i = 0; i < 15; i++) {
      expect((await GET()).status).toBe(200);
    }
  });
});
