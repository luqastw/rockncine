import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { VideoSourceKind } from "@/lib/video-source";

// Record<VideoSourceKind, true> em vez de array solto — se VideoSourceKind
// ganhar um membro novo e este objeto não for atualizado, o TS acusa erro de
// propriedade faltando em vez de deixar passar silenciosamente (era assim
// que DIRECT_MEDIA ficou de fora e o PATCH rejeitava 400 sem avisar).
const VALID_SOURCES: Record<VideoSourceKind, true> = {
  YOUTUBE: true,
  VIMEO: true,
  GENERIC_IFRAME: true,
  DIRECT_MEDIA: true,
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "não autenticado." }, { status: 401 });
  }

  const { code } = await params;
  const body = await req.json().catch(() => null);
  const source = body?.source;
  const embedUrl = typeof body?.embedUrl === "string" ? body.embedUrl : null;
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : null;

  if (typeof source !== "string" || !VALID_SOURCES[source as VideoSourceKind] || !embedUrl || !sourceUrl) {
    return NextResponse.json({ error: "payload inválido." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    return NextResponse.json({ error: "sala não encontrada." }, { status: 404 });
  }

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "não é membro desta sala." }, { status: 403 });
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { videoSource: source as VideoSourceKind, embedUrl, videoSourceUrl: sourceUrl },
  });

  return NextResponse.json({ ok: true });
}
