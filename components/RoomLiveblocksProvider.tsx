"use client";

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { useState, type ReactNode } from "react";
import type { VideoSourceKind } from "@/lib/video-source";
import { LiveblocksBadgeA11y } from "@/components/room/LiveblocksBadgeA11y";

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
      badgeLocation="bottom-left"
    >
      <RoomProvider
        id={roomCode}
        initialPresence={{ userId, name: userName }}
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
      <LiveblocksBadgeA11y />
    </LiveblocksProvider>
  );
}
