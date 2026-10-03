"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getChatFeed, subscribeChatFeed } from "@/lib/chat-feed";
import type { ChatFeedItem } from "@/lib/chat-event";

// Assinatura do feed de chat.
//
// Só o `<Chat>` chama isto. A store é quem guarda o estado e quem notifica
// (FR-001, docs/specs/13-chat-sala/spec.md): com a assinatura morando dentro do
// log, uma mensagem nova acorda o log e nada mais — antes, `useChat` era chamado
// no corpo de `RoomExperience` e a mesma mensagem re-renderizava presença, sync,
// player e cabeçalho (medido em docs/specs/13-chat-sala/research.md, seção 2).
//
// `getChatFeed` devolve a mesma referência enquanto o feed não muda, que é o que
// o `useSyncExternalStore` exige para não re-renderizar à toa.

//
// O `roomCode` entra porque a store é um módulo: sem ele, entrar numa segunda
// sala no mesmo carregamento da página mostraria — por um quadro — o histórico
// da primeira. A chave vira a memória da store (FR-007).
export function useChatFeed(roomCode: string): ChatFeedItem[] {
  const subscribe = useCallback(
    (listener: () => void) => subscribeChatFeed(listener),
    [],
  );
  const getSnapshot = useCallback(() => getChatFeed(roomCode), [roomCode]);
  const getServerSnapshot = useCallback(() => EMPTY_FEED, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// O snapshot de servidor é sempre vazio: nada de chat é renderizado no servidor
// (o feed nasce em memória, na sala), e um array constante evita realocar a cada
// chamada do React.
const EMPTY_FEED: ChatFeedItem[] = [];