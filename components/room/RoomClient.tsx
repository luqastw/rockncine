"use client";

import { RoomLiveblocksProvider } from "@/components/RoomLiveblocksProvider";
import { RoomExperience } from "@/components/room/RoomExperience";
import { LiveKitProvider } from "@/components/room/LiveKitProvider";
import { useVideoQuality } from "@/hooks/useVideoQuality";
import type { VideoSourceKind } from "@/lib/video-source";

export function RoomClient({
  roomCode,
  roomName,
  userId,
  userName,
  initialVideo,
  livekitUrl,
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
  // `null` quando o deploy não configurou o Livekit: o wrapper não é montado e
  // a sala fica no modo player. Vem do server component por prop em vez de
  // `process.env` no cliente, porque o valor tem de ser resolvido no servidor
  // (docs/specs/12-transmissao-screen-share/spec.md, seção 10).
  livekitUrl: string | null;
}) {
  const quality = useVideoQuality();

  return (
    // O `LiveKitRoom` envolve a sala sempre, não só quando há transmissão
    // (docs/specs/12-transmissao-screen-share/spec.md, seção 7) — por isso
    // fica ACIMA do `RoomProvider`, e não dentro dele.
    <LiveKitProvider serverUrl={livekitUrl} roomCode={roomCode}>
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
          livekitUrl={livekitUrl}
        />
      </RoomLiveblocksProvider>
    </LiveKitProvider>
  );
}
