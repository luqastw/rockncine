import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMyPresence, useOthers } from "@liveblocks/react";

// o quanto a pessoa pode digitar em silêncio antes de o indicador de "digitando"
// cair (FR-029). Abaixo disso, a presence ficaria `true` para sempre se alguém
// largasse o campo no meio da frase.
const TYPING_IDLE_MS = 1200;

export function useTypingPresence(userId: string) {
  const others = useOthers();
  const [, updateMyPresence] = useMyPresence();
  const updateRef = useRef(updateMyPresence);
  // o aviso de digitação é presence, não estado de sala: os outros clients é que
  // precisam saber (FR-029). A ref guarda o timer para cancelá-lo a cada tecla,
  // e o `typingRef` evita reescrever a presence quando ela já está `true` —
  // presença por tecla seria tráfego por tecla.
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    updateRef.current = updateMyPresence;
  }, [updateMyPresence]);

  const marcarDigitando = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      updateMyPresence({ typing: true });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      typingRef.current = false;
      updateMyPresence({ typing: false });
    }, TYPING_IDLE_MS);
  }, [updateMyPresence]);

  const pararDeDigitar = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (!typingRef.current) return;
    typingRef.current = false;
    updateMyPresence({ typing: false });
  }, [updateMyPresence]);

  // timer pendente não sobrevive ao unmount: ele escreveria presence de um
  // componente que não existe mais.
  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
      if (!typingRef.current) return;
      typingRef.current = false;
      updateRef.current({ typing: false });
    },
    [],
  );

  // Quem está digitando agora, deduplicado por pessoa: `useOthers` lista por
  // conexão, e a mesma pessoa com duas abas não deve aparecer duas vezes aqui
  // (mesmo dedupe de `PresenceList.tsx`).
  const typingNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const other of others) {
      const id = other.presence?.userId;
      if (!id || id === userId || other.presence?.typing !== true) continue;
      names.set(id, other.presence?.name || "alguém");
    }
    return [...names.values()];
  }, [others, userId]);

  return { marcarDigitando, pararDeDigitar, typingNames };
}
