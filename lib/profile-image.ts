import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 2_097_152;
export const MAX_STORED_BYTES = 65_536;
export const MAX_SIDE_PX = 4096;

const OUTPUT_SIDE_PX = 256;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);
const QUALITIES = [80, 60];

export type ProcessedProfileImage = { ok: true; data: Buffer } | { ok: false };

function open(input: Buffer) {
  return sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_SIDE_PX * MAX_SIDE_PX,
  });
}

export async function processProfileImage(
  input: Buffer,
): Promise<ProcessedProfileImage> {
  try {
    const metadata = await open(input).metadata();
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      return { ok: false };
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_SIDE_PX ||
      metadata.height > MAX_SIDE_PX
    ) {
      return { ok: false };
    }

    for (const quality of QUALITIES) {
      const data = await open(input)
        .rotate()
        .resize(OUTPUT_SIDE_PX, OUTPUT_SIDE_PX, {
          fit: "cover",
          position: "centre",
        })
        .webp({ quality })
        .toBuffer();
      if (data.length <= MAX_STORED_BYTES) return { ok: true, data };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
