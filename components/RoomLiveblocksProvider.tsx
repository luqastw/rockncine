"use client";

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { useState, type ReactNode } from "react";
import type { VideoSourceKind } from "@/lib/video-source";

export function RoomLiveblocksProvider({
  roomCode,
  userId,
  userName,
  initialVideo,
  children,
}: {
  roomCode: string;
  userId: string;
  userName: string;
  initialVideo: {
    source: VideoSourceKind | null;
    embedUrl: string | null;
    sourceUrl: string | null;
  };
  children: ReactNode;
}) {
  // Date.now() é impuro — lazy initializer do useState roda só uma vez, no mount.
  const [mountedAt] = useState(() => Date.now());

  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      throttle={80}
    >
      <RoomProvider
        id={roomCode}
        initialPresence={{ userId, name: userName, isMuted: false }}
        initialStorage={{
          video: { ...initialVideo, loadedAt: initialVideo.embedUrl ? mountedAt : null },
          player: {
            isPlaying: false,
            currentTime: 0,
            updatedAt: mountedAt,
            lastActorId: "",
          },
        }}
      >
        {children}
      </RoomProvider>
    </LiveblocksProvider>
  );
}
