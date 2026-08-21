"use client";

import { useEffect } from "react";
import { useBroadcastEvent } from "@liveblocks/react";

// Broadcast de "entrou na sala" — precisa viver num componente que fica
// montado a sala inteira, não dentro de <Chat> (que desmonta/remonta ao
// entrar/sair de fullscreen ou alternar modo teatro em RoomExperience,
// re-disparando o aviso pra todo mundo a cada toggle — era um bug real).
export function useRoomJoinAnnouncement(userName: string) {
  const broadcast = useBroadcastEvent();

  useEffect(() => {
    broadcast({
      type: "SYSTEM_MESSAGE",
      id: crypto.randomUUID(),
      text: `${userName} entrou na sala`,
      ts: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
