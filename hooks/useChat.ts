"use client";

import { useCallback, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

const MAX_MESSAGES = 30;

export type ChatFeedItem = ChatEvent | SystemEvent;

// Chat não persiste (decisão travada) — histórico vive só neste estado React,
// reconstituído a zero pra quem entra depois (ver docs/specs/01-fundacao-mvp/spec.md, seção 2). Mensagens
// de sistema (entrada na sala) entram no mesmo feed, distinguidas por `type`.
export function useChat({ userId, userName }: { userId: string; userName: string }) {
  const [messages, setMessages] = useState<ChatFeedItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const broadcast = useBroadcastEvent();

  const appendUnique = useCallback((event: ChatFeedItem) => {
    if (seenIdsRef.current.has(event.id)) return;
    seenIdsRef.current.add(event.id);
    setMessages((prev) => {
      const next = [...prev, event].slice(-MAX_MESSAGES);
      // O feed era limitado a 200 mensagens, mas o índice de ids vistos não:
      // ele acumulava toda mensagem da sessão para sempre. Quando o slice de
      // fato descarta algo, o índice é reconstruído a partir do que sobrou —
      // continua deduplicando o que está na tela e para de crescer sem limite.
      if (next.length !== prev.length + 1) {
        seenIdsRef.current = new Set(next.map((message) => message.id));
      }
      return next;
    });
  }, []);

  useEventListener(({ event }) => {
    if (event.type !== "CHAT_MESSAGE" && event.type !== "SYSTEM_MESSAGE") return;
    appendUnique(event);
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const event: ChatEvent = {
        type: "CHAT_MESSAGE",
        id: crypto.randomUUID(),
        authorId: userId,
        authorName: userName,
        text: trimmed,
        ts: Date.now(),
      };

      appendUnique(event); // otimista — não espera o round-trip do broadcast
      broadcast(event);
    },
    [appendUnique, broadcast, userId, userName],
  );

  // exposto pra fora do feed de chat próprio — useRoomLeaveAnnouncement
  // (montado em RoomExperience, fora de <Chat>) usa isso pra colocar
  // "fulano saiu da sala" no mesmo feed sem duplicar o estado de mensagens.
  return { messages, sendMessage, appendMessage: appendUnique };
}
