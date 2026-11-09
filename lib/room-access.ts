import type { Room } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RoomAccess =
  | { ok: true; room: Room }
  | { ok: false; status: 403 | 404; message: string };

export async function findRoomForMember(code: string, userId: string): Promise<RoomAccess> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) return { ok: false, status: 404, message: "sala não encontrada." };

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
  });
  if (!membership) return { ok: false, status: 403, message: "não é membro desta sala." };

  return { ok: true, room };
}
