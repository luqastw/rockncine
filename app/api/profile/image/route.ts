import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES, processProfileImage } from "@/lib/profile-image";
import { rateLimitUser } from "@/lib/rate-limit";

const MULTIPART_OVERHEAD_BYTES = 65_536;
const TOO_LARGE = "imagem muito grande (máx 2 MB).";

const RATE_LIMIT = { scope: "profile-image", limit: 10, windowMs: 3_600_000 };

function unauthenticated() {
  return NextResponse.json({ error: "não autenticado." }, { status: 401 });
}

function tooLarge() {
  return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
}

function isUploadedFile(value: unknown): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { arrayBuffer?: unknown; size?: unknown };
  return typeof candidate.arrayBuffer === "function" && typeof candidate.size === "number";
}

async function readLimitedBody(req: Request, limit: number): Promise<Uint8Array | "too-large" | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return "too-large";
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return unauthenticated();
  }

  const limited = await rateLimitUser(userId, RATE_LIMIT);
  if (limited) return limited;

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return tooLarge();
  }

  const body = await readLimitedBody(req, MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES);
  if (body === "too-large") return tooLarge();
  if (!body) {
    return NextResponse.json({ error: "envie uma imagem." }, { status: 400 });
  }

  const form = await new Response(body as BodyInit, {
    headers: { "content-type": req.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = form?.get("file");
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "envie uma imagem." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) return tooLarge();

  const processed = await processProfileImage(Buffer.from(await file.arrayBuffer()));
  if (!processed.ok) {
    return NextResponse.json({ error: "formato de imagem não suportado." }, { status: 415 });
  }

  const data = new Uint8Array(processed.data);
  const saved = await prisma.profileImage.upsert({
    where: { userId },
    create: { userId, data },
    update: { data },
    select: { updatedAt: true },
  });

  return NextResponse.json({ v: saved.updatedAt.getTime() });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return unauthenticated();

  const limited = await rateLimitUser(userId, RATE_LIMIT);
  if (limited) return limited;

  await prisma.profileImage.deleteMany({ where: { userId } });
  return new Response(null, { status: 204 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return unauthenticated();

  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { updatedAt: true },
  });
  return NextResponse.json(
    { v: image ? image.updatedAt.getTime() : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
