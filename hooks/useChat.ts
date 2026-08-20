"use client";

import { useCallback, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import type { ChatEvent } from "@/liveblocks.config";

const MAX_MESSAGES = 200;

// Chat não persiste (decisão travada) — histórico vive só neste estado React,
// reconstituído a zero pra quem entra depois (ver SPEC.md seção 2).
export function useChat({ userId, userName }: { userId: string; userName: string }) {
  const [messages, setMessages] = useState<ChatEvent[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const broadcast = useBroadcastEvent();

  const appendUnique = useCallback((event: ChatEvent) => {
    if (seenIdsRef.current.has(event.id)) return;
    seenIdsRef.current.add(event.id);
    setMessages((prev) => [...prev, event].slice(-MAX_MESSAGES));
  }, []);

  useEventListener(({ event }) => {
    if (event.type !== "CHAT_MESSAGE") return;
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

  return { messages, sendMessage };
}
