// @vitest-environment node
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_STORED_BYTES, processProfileImage } from "./profile-image";

const base = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 90 },
    },
  });

async function expectSquareWebp(data: Buffer) {
  const meta = await sharp(data).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.width).toBe(256);
  expect(meta.height).toBe(256);
  expect(data.length).toBeLessThanOrEqual(MAX_STORED_BYTES);
}

describe("processProfileImage", () => {
  it("aceita PNG", async () => {
    const result = await processProfileImage(
      await base(300, 300).png().toBuffer(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) await expectSquareWebp(result.data);
  });

  it("aceita JPEG", async () => {
    const result = await processProfileImage(
      await base(300, 300).jpeg().toBuffer(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) await expectSquareWebp(result.data);
  });

  it("aceita WebP", async () => {
    const result = await processProfileImage(
      await base(300, 300).webp().toBuffer(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) await expectSquareWebp(result.data);
  });

  it("recorta 1000x500 para 256x256", async () => {
    const result = await processProfileImage(
      await base(1000, 500).png().toBuffer(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) await expectSquareWebp(result.data);
  });

  it("rejeita GIF", async () => {
    const result = await processProfileImage(
      await base(50, 50).gif().toBuffer(),
    );
    expect(result).toEqual({ ok: false });
  });

  it("rejeita SVG", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    expect(await processProfileImage(svg)).toEqual({ ok: false });
  });

  it("rejeita PNG truncado", async () => {
    const valid = await sharp(randomBytes(200 * 200 * 3), {
      raw: { width: 200, height: 200, channels: 3 },
    })
      .png()
      .toBuffer();
    const truncated = valid.subarray(0, Math.floor(valid.length / 2));
    expect(await processProfileImage(truncated)).toEqual({ ok: false });
  });

  it("rejeita PNG 4097x100", async () => {
    const result = await processProfileImage(
      await base(4097, 100).png().toBuffer(),
    );
    expect(result).toEqual({ ok: false });
  });

  it("remove EXIF da saída", async () => {
    const input = await base(200, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processProfileImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
  });

  it("respeita orientação EXIF 6 numa imagem 200x100", async () => {
    const input = await base(200, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processProfileImage(input);
    expect(result.ok).toBe(true);
    if (result.ok) await expectSquareWebp(result.data);
  });

  it("ruído 1500x1500 respeita o limite de bytes", async () => {
    const noise = await sharp(randomBytes(1500 * 1500 * 3), {
      raw: { width: 1500, height: 1500, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const result = await processProfileImage(noise);
    if (!result.ok) return;
    expect(result.data.length).toBeLessThanOrEqual(MAX_STORED_BYTES);
  });

  it("rejeita buffer vazio", async () => {
    expect(await processProfileImage(Buffer.alloc(0))).toEqual({ ok: false });
  });

  it("rejeita bytes aleatórios", async () => {
    expect(await processProfileImage(randomBytes(2048))).toEqual({ ok: false });
  });
});
