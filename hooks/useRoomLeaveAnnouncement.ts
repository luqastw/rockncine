"use client";

import { useEffect, useRef } from "react";
import { useOthersListener } from "@liveblocks/react";
import { parseChatEvent } from "@/lib/chat-event";
import { appendChatItem } from "@/lib/chat-feed";

// refresh de página ou queda de rede breve gera um "leave" seguido de um
// "enter" do mesmo userId em poucos segundos — sem segurar o "leave", cada F5
// aparecia como "fulano saiu" + "fulano entrou" pra todo mundo.
const LEAVE_DEBOUNCE_MS = 4000;

// Par de useRoomJoinAnnouncement.ts, mas sem broadcast (decisão travada): o
// disparo de "saiu" teria que rodar em pagehide/beforeunload, exatamente
// quando o socket já está caindo, sem garantia de entrega. Em vez disso, cada
// cliente já conectado detecta localmente via useOthersListener — mesmo
// mecanismo que já alimenta useOthers() — e adiciona a mensagem só no
// próprio feed local (sem broadcast, sem risco de N cópias vindas de N
// observadores).
//
// Precisa viver no mesmo nível de RoomExperience (nunca dentro de <Chat>,
// mesma razão do useRoomJoinAnnouncement): um unmount/remount por toggle de
// fullscreen/teatro não pode reprocessar o histórico de presence do zero.
//
// `appendMessage` deixou de ser parâmetro: o feed mora numa store de módulo
// (FR-001, docs/specs/13-chat-sala/spec.md) e `appendChatItem` é importado
// direto. Passar a função como prop obrigaria a sala a ter a assinatura do feed
// na mão — que é justamente o estado que saiu do componente de sala.
export function useRoomLeaveAnnouncement(myUserId: string) {
  // userId -> timeout pendente de "saiu", pra poder cancelar se um "enter" do
  // mesmo userId chegar antes do timer estourar (reconexão/F5).
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const cancelPending = (userId: string) => {
    const pending = pendingRef.current.get(userId);
    if (pending) {
      clearTimeout(pending);
      pendingRef.current.delete(userId);
    }
  };

  useOthersListener((event) => {
    // narrar por `event.type` primeiro (não desestruturar `user` antes disso)
    // — o tipo `OthersEvent` inclui a variante "reset" sem `user`, então
    // desestruturar cedo faz o TS ver `user` como possivelmente undefined em
    // toda a união.
    if (event.type === "leave") {
      const userId = event.user.presence?.userId;
      if (!userId || userId === myUserId) return; // nunca narra sobre mim mesmo
      // `others` (por CONEXÃO, não por pessoa — achado 26, mesmo dedupe de
      // PresenceList.tsx) ainda tem outra aba do mesmo userId conectada:
      // não é uma saída real, é só uma conexão a menos da mesma pessoa.
      const stillConnected = event.others.some((o) => o.presence?.userId === userId);
      if (stillConnected) return;
      cancelPending(userId); // timer órfão de um leave anterior não cancelado
      const name = event.user.presence?.name || "alguém";
      const timeoutId = setTimeout(() => {
        pendingRef.current.delete(userId);
        // `name` vem da presence do outro cliente, que é escrita pelo próprio
        // cliente daquele participante. Passa pelo validador pelo mesmo motivo
        // que o broadcast passa: é entrada não confiável, e o texto vai
        // direto pro `Chat`.
        const event = parseChatEvent({
          type: "SYSTEM_MESSAGE",
          id: crypto.randomUUID(),
          text: `${name} saiu da sala`,
          ts: Date.now(),
        });
        if (event) appendChatItem(event);
      }, LEAVE_DEBOUNCE_MS);
      pendingRef.current.set(userId, timeoutId);
      return;
    }

    if (event.type === "enter") {
      const userId = event.user.presence?.userId;
      if (!userId) return;
      cancelPending(userId);
    }
  });

  // limpa timers pendentes se o componente que hospeda o hook desmontar
  // (não deveria acontecer em uso normal — RoomExperience fica montado a
  // sala inteira — mas evita disparo de setState após unmount).
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const timeoutId of pending.values()) clearTimeout(timeoutId);
      pending.clear();
    };
  }, []);
}
