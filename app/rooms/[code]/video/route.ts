import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveVideoUrl } from "@/lib/video-source";

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
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : null;
  if (!sourceUrl) {
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

  // `source`/`embedUrl` nunca são aceitos do client — eram gravados sem
  // nenhuma validação de conteúdo (achado 5, seção 11 do SPEC.md), permitindo
  // persistir um `embedUrl` arbitrário (ex. `data:text/html,...`) que depois
  // ia direto pro `iframe src`/`a href` de todo mundo que reabrisse a sala.
  // Só `sourceUrl` é aceito; `source`/`embedUrl` são sempre re-derivados
  // aqui, pelo mesmo caminho de validação usado em `/api/resolve-embed`.
  const resolved = await resolveVideoUrl(sourceUrl);
  if (!resolved) {
    return NextResponse.json({ error: "link inválido." }, { status: 400 });
  }

  await prisma.room.update({
    where: { id: room.id },
    data: {
      videoSource: resolved.source,
      embedUrl: resolved.embedUrl,
      videoSourceUrl: resolved.sourceUrl,
    },
  });

  return NextResponse.json({ ok: true });
}
