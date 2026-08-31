"use client";

import { RoomLiveblocksProvider } from "@/components/RoomLiveblocksProvider";
import { RoomExperience } from "@/components/room/RoomExperience";
import { useVideoQuality } from "@/hooks/useVideoQuality";
import type { VideoSourceKind } from "@/lib/video-source";

export function RoomClient({
  roomCode,
  roomName,
  userId,
  userName,
  initialVideo,
}: {
  roomCode: string;
  roomName: string | null;
  userId: string;
  userName: string;
  initialVideo: {
    source: VideoSourceKind | null;
    embedUrl: string | null;
    sourceUrl: string | null;
  };
}) {
  const quality = useVideoQuality();

  return (
    <RoomLiveblocksProvider
      roomCode={roomCode}
      userId={userId}
      userName={userName}
      initialVideo={initialVideo}
    >
      <RoomExperience
        roomCode={roomCode}
        roomName={roomName}
        userId={userId}
        userName={userName}
        videoQuality={quality}
      />
    </RoomLiveblocksProvider>
  );
}
