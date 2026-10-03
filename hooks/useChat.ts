"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBroadcastEvent, useEventListener, useStatus } from "@liveblocks/react";
import type { ChatEvent } from "@/liveblocks.config";
import { appendChatItem } from "@/lib/chat-feed";
import { MAX_TEXT_LENGTH, parseChatEvent } from "@/lib/chat-event";

// Reexportado para os consumidores que já importavam daqui (Chat.tsx).
// A definição mora em `lib/chat-event.ts` junto do validador, porque
// `ChatFeedItem` e o que o validador devolve precisam ser o mesmo tipo por
// construção.
export type { ChatFeedItem } from "@/lib/chat-event";

// Teto da fila local de envio (FR-005). Existe só para a memória não depender de
// quanto o usuário escreveu: com o socket fora, quem não chega a 50 mensagens
// pendentes não vai chegar — e a fila despeja em ordem assim que volta.
const MAX_PENDING = 50;

// Chat não persiste (decisão travada) — histórico vive na store do módulo
// (`lib/chat-feed.ts`), reconstituída a zero pra quem entra depois (ver
// docs/specs/01-fundacao-mvp/spec.md, seção 2). Mensagens de sistema (entrada na
// sala) entram no mesmo feed, distinguidas por `type`.
//
// O estado NÃO mora aqui: `messages` é assinado por `useChatFeed` dentro do
// `<Chat>` e este hook é só o emissor. É a separação que impede uma mensagem de
// chat de re-renderizar a sala inteira (FR-001/FR-002,
// docs/specs/13-chat-sala/spec.md).
export function useChat({ userId, userName }: { userId: string; userName: string }) {
  const broadcast = useBroadcastEvent();
  const status = useStatus();
  // Mensagens escritas fora de `connected`, na ordem em que foram escritas.
  //
  // A primeira versão desta fila era o `shouldQueueEventIfNotReady` do
  // Liveblocks, e foi abandonada: o próprio pacote documenta a opção como algo
  // que "não temos certeza de querer suportar no futuro" (`BroadcastOptions` em
  // `@liveblocks/core`). Construir a confiabilidade do chat sobre uma opção
  // declarada instável é o tipo de dívida que só aparece em produção. A fila é
  // nossa, cabe em vinte linhas e é testável.
  const pendingRef = useRef<ChatEvent[]>([]);

  const flush = useCallback(() => {
    const queue = pendingRef.current;
    if (queue.length === 0) return;
    // Esvazia ANTES de transmitir: se `broadcast` lançar, a re-renderização
    // seguinte tentaria de novo o mesmo lote em duplicidade.
    pendingRef.current = [];
    for (const event of queue) broadcast(event);
  }, [broadcast]);

  useEffect(() => {
    if (status !== "connected") return;
    flush();
  }, [flush, status]);

  useEventListener(({ event }) => {
    // O payload vem de outro cliente e é renderizado direto no `Chat`. Sem
    // esta validação, um `{ text: {...} }` derrubava o React inteiro
    // ("Objects are not valid as a React child") e cada participante perdia a
    // sala — não havia `error.tsx` no segmento para conter a falha.
    const parsed = parseChatEvent(event);
    if (!parsed) return;
    appendChatItem(parsed);
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

      // Otimista e imediato: o item entra no log local antes de qualquer
      // decisão de transporte, então quem escreve nunca espera a rede para ver a
      // própria frase.
      appendChatItem(event);

      if (status === "connected") {
        broadcast(event);
        return;
      }

      const pending = [...pendingRef.current, event];
      // O corte descarta as mais antigas, que são as que a pessoa já viu
      // sumirem da tela faz tempo; o que fica é a janela recente.
      pendingRef.current = pending.length > MAX_PENDING ? pending.slice(-MAX_PENDING) : pending;
    },
    [broadcast, status, userId, userName],
  );

  // exposto pra fora do feed de chat próprio — useRoomLeaveAnnouncement
  // (montado em RoomExperience, fora de <Chat>) usa isso pra colocar
  // "fulano saiu da sala" no mesmo feed sem duplicar o estado de mensagens.
  // A identidade é estável no módulo: passar isto como prop desligaria o
  // `<Chat>` memoizado a cada render da sala.
  const appendMessage = appendChatItem;

  // `messages` NÃO volta aqui: quem assina o feed é `useChatFeed`, dentro do
  // `<Chat>`. Devolver o estado lido aqui devolveria a sala ao caminho quente
  // que a spec 13 fecha — o contrato é separado entre quem envia e quem
  // renderiza exatamente por isso.
  return { sendMessage, appendMessage };
}