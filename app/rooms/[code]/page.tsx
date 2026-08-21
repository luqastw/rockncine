import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoomLiveblocksProvider } from "@/components/RoomLiveblocksProvider";
import { RoomExperience } from "@/components/room/RoomExperience";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getServerSession(authOptions);

  const room = await prisma.room.findUniqueOrThrow({
    where: { code },
    select: {
      code: true,
      name: true,
      videoSource: true,
      embedUrl: true,
      videoSourceUrl: true,
    },
  });

  const userId = session!.user!.id;
  const userName = session!.user!.name ?? session!.user!.email ?? "sem nome";

  return (
    <RoomLiveblocksProvider
      roomCode={room.code}
      userId={userId}
      userName={userName}
      initialVideo={{
        source: room.videoSource,
        embedUrl: room.embedUrl,
        sourceUrl: room.videoSourceUrl,
      }}
    >
      <RoomExperience
        roomCode={room.code}
        roomName={room.name}
        userId={userId}
        userName={userName}
      />
    </RoomLiveblocksProvider>
  );
}
