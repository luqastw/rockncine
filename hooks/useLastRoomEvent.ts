"use client";

import { useState } from "react";
import { useEventListener } from "@liveblocks/react";
import type { PlayerEvent, RoomEvent } from "@/liveblocks.config";

const PLAYER_EVENT_TYPES = new Set<RoomEvent["type"]>([
  "LOAD_VIDEO",
  "PLAY",
  "PAUSE",
  "SEEK",
]);

// Só pra alimentar o flash visual do SyncRing — desacoplado dos hooks de sync
// de player, que cuidam de aplicar PLAY/PAUSE/SEEK no player de verdade.
// Filtra pra só LOAD_VIDEO/PLAY/PAUSE/SEEK (SPEC.md seção 8): sem isso, todo
// CHAT_MESSAGE/SYSTEM_MESSAGE também fazia o anel piscar, lido como eco de
// sync mesmo sem nenhuma ação de player ter acontecido.
export function useLastRoomEvent(): PlayerEvent | null {
  const [lastEvent, setLastEvent] = useState<PlayerEvent | null>(null);
  useEventListener(({ event }) => {
    if (!PLAYER_EVENT_TYPES.has(event.type)) return;
    setLastEvent(event as PlayerEvent);
  });
  return lastEvent;
}
