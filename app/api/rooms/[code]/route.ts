import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Compara o host do `Origin` com o da requisição. Um `Origin` presente que não
// seja interpretável (inclui `null`, de iframe em sandbox) não pode ser
// confirmado como mesma origem, então conta como divergência.
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;

  try {
    // `host` antes de `req.url`: atrás de proxy é o cabeçalho que carrega o
    // host público usado pelo browser para montar o `Origin`.
    const requestHost = req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

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
