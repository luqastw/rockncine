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
    // No mount o socket do Liveblocks ainda está `connecting` (a conexão só
    // fecha depois do roundtrip pra /api/liveblocks-auth) — sem
    // `shouldQueueEventIfNotReady`, `broadcastEvent` descarta o evento em
    // silêncio, e "entrou na sala" nunca era entregue a ninguém, 0% das
    // vezes (achado 4, docs/specs/04-auditoria-ui-ux-rodada-2/spec.md).
    broadcast(
      {
        type: "SYSTEM_MESSAGE",
        id: crypto.randomUUID(),
        text: `${userName} entrou na sala`,
        ts: Date.now(),
      },
      { shouldQueueEventIfNotReady: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
