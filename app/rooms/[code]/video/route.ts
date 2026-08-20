import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { VideoSourceKind } from "@/lib/video-source";

const VALID_SOURCES: VideoSourceKind[] = ["YOUTUBE", "VIMEO", "GENERIC_IFRAME"];

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

  if (!VALID_SOURCES.includes(source) || !embedUrl || !sourceUrl) {
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
    data: { videoSource: source, embedUrl, videoSourceUrl: sourceUrl },
  });

  return NextResponse.json({ ok: true });
}
