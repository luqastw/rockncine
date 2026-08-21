"use client";

import { useState } from "react";
import { useEventListener } from "@liveblocks/react";
import type { RoomEvent } from "@/liveblocks.config";

// Só pra alimentar o flash visual do SyncRing — desacoplado dos hooks de sync
// de player, que cuidam de aplicar PLAY/PAUSE/SEEK no player de verdade.
export function useLastRoomEvent() {
  const [lastEvent, setLastEvent] = useState<RoomEvent | null>(null);
  useEventListener(({ event }) => setLastEvent(event));
  return lastEvent;
}
