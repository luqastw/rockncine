import { Liveblocks } from "@liveblocks/node";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// instanciado dentro do handler (não no top-level do módulo) pra não quebrar a
// coleta de página do Next em build sem LIVEBLOCKS_SECRET_KEY definida ainda.
function getLiveblocksClient() {
  return new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("não autenticado.", { status: 401 });
  }

  const { room: roomCode } = await req.json();
  if (typeof roomCode !== "string") {
    return new Response("room inválida.", { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: roomCode } });
  if (!room) {
    return new Response("sala não encontrada.", { status: 404 });
  }

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
  });
  if (!membership) {
    return new Response("não é membro desta sala.", { status: 403 });
  }

  const liveblocks = getLiveblocksClient();
  const session_ = liveblocks.prepareSession(session.user.id, {
    userInfo: {
      name: session.user.name ?? session.user.email ?? "sem nome",
    },
  });
  session_.allow(roomCode, session_.FULL_ACCESS);

  const { status, body } = await session_.authorize();
  return new Response(body, { status });
}
