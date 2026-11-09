import { Liveblocks } from "@liveblocks/node";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findRoomForMember } from "@/lib/room-access";

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

  const payload: unknown = await req.json().catch(() => null);
  const roomCode = (payload as { room?: unknown } | null)?.room;
  if (typeof roomCode !== "string" || roomCode.length === 0) {
    return new Response("room inválida.", { status: 400 });
  }

  const access = await findRoomForMember(roomCode, session.user.id);
  if (!access.ok) {
    return new Response(access.message, { status: access.status });
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
