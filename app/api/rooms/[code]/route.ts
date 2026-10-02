import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sameOrigin } from "@/lib/request";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "origem não permitida." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "não autenticado." }, { status: 401 });
  }

  const { code } = await params;
  // Duas comparações de igualdade exata em vez de `mode: "insensitive"`: o
  // ILIKE trata `%`/`_` do segmento de URL cru como curinga (ver lib/rooms.ts).
  const room = await prisma.room.findFirst({
    where: { OR: [{ code }, { code: code.toUpperCase() }] },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    return NextResponse.json({ error: "sala não encontrada." }, { status: 404 });
  }

  if (room.ownerId !== session.user.id) {
    return NextResponse.json({ error: "só o dono pode excluir esta sala." }, { status: 403 });
  }

  // `RoomMember` antes de `Room`, numa transação: a migration que adiciona
  // `ON DELETE CASCADE` existe no repo mas não foi aplicada no banco, então o
  // FK atual (`NO ACTION`) faria um `room.delete` cru violar a constraint.
  await prisma.$transaction([
    prisma.roomMember.deleteMany({ where: { roomId: room.id } }),
    prisma.room.delete({ where: { id: room.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
