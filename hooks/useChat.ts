"use client";

import { useCallback, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import type { ChatEvent } from "@/liveblocks.config";
import { MAX_TEXT_LENGTH, parseChatEvent, type ChatFeedItem } from "@/lib/chat-event";

// Reexportado para os consumidores que já importavam daqui (Chat.tsx,
// useRoomLeaveAnnouncement.ts). A definição mora em `lib/chat-event.ts` junto
// do validador, porque `ChatFeedItem` e o que o validador devolve precisam ser
// o mesmo tipo por construção.
export type { ChatFeedItem } from "@/lib/chat-event";

const MAX_MESSAGES = 30;

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
    // O payload vem de outro cliente e é renderizado direto no `Chat`. Sem
    // esta validação, um `{ text: {...} }` derrubava o React inteiro
    // ("Objects are not valid as a React child") e cada participante perdia a
    // sala — não havia `error.tsx` no segmento para conter a falha.
    const parsed = parseChatEvent(event);
    if (!parsed) return;
    appendUnique(parsed);
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
        // Corta no mesmo teto que o validador de entrada aplica. Sem isto, a
        // própria UI produzia um payload que seria descartado do lado de
        // todos os outros — a mensagem sumiria depois de um round-trip.
        text: trimmed.slice(0, MAX_TEXT_LENGTH),
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
