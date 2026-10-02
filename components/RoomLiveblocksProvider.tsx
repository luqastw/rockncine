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
          // Nenhuma transmissão no primeiro mount. A porta de entrada do modo
          // transmissão é sempre uma ação explícita de quem entra
          // (FR-001, docs/specs/12-transmissao-screen-share/spec.md) — nada
          // aqui reidrata um transmissor que já existia, e o seed do storage
          // do Liveblocks é aplicado só quando o storage da sala está vazio.
          broadcast: null,
        }}
      >
        {children}
      </RoomProvider>
      <LiveblocksBadgeA11y />
    </LiveblocksProvider>
  );
}
