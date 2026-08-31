import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoomClient } from "@/components/room/RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getServerSession(authOptions);

  // ver layout.tsx: igualdade exata em vez de ILIKE (achado 1, docs/specs/04-auditoria-ui-ux-rodada-2/spec.md).
  const room = await prisma.room.findFirst({
    where: { OR: [{ code }, { code: code.toUpperCase() }] },
    select: {
      code: true,
      name: true,
      videoSource: true,
      embedUrl: true,
      videoSourceUrl: true,
    },
  });
  if (!room) notFound();

  const userId = session!.user!.id;
  const userName = session!.user!.name ?? session!.user!.email ?? "sem nome";

  return (
    <RoomClient
      roomCode={room.code}
      roomName={room.name}
      userId={userId}
      userName={userName}
      initialVideo={{
        source: room.videoSource,
        embedUrl: room.embedUrl,
        sourceUrl: room.videoSourceUrl,
      }}
    />
  );
}
