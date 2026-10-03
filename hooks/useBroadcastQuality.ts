"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_BROADCAST_QUALITY,
  isBroadcastQualityLevel,
  type BroadcastQualityLevel,
} from "@/lib/broadcast-quality";

// Mesma forma do `useVideoQuality`: preferência local em `localStorage`, lida
// por `useSyncExternalStore` com snapshot de servidor. O motivo de passar por
// store externo em vez de `useState` está no comentário longo daquele hook e não
// se repete aqui: ler `localStorage` no render quebrava a hidratação.

const STORAGE_KEY = "rockncine-broadcast-quality";

// A MESMA referência em toda chamada. `useSyncExternalStore` compara com
// `Object.is` e um literal novo aqui emite o aviso de hydration do React 19.
const SERVER_SNAPSHOT: BroadcastQualityLevel = DEFAULT_BROADCAST_QUALITY;

function getServerSnapshot(): BroadcastQualityLevel {
  return SERVER_SNAPSHOT;
}

// `getSnapshot` precisa devolver valor referencialmente estável, senão o React
// re-renderiza em loop. O cache é chaveado pela string crua: só muda quando o
// conteúdo do localStorage muda.
//
// A validação do que vem do storage acontece nos dois pontos de leitura, e o
// motivo de não ser um cast é o mesmo do `useVideoQuality`: o localStorage é
// estado não confiável (valor legado, edição manual, lixo antigo) e um
// `as BroadcastQualityLevel` passaria, virando `undefined` em
// `BROADCAST_QUALITIES[...]` — um crash na hora de transmitir, que é o pior
// lugar para um valor corrompido aparecer.
let cachedRaw: string | null | undefined;
let cachedValue: BroadcastQualityLevel = getServerSnapshot();

function getClientSnapshot(): BroadcastQualityLevel {
  if (typeof window === "undefined") return getServerSnapshot();

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  cachedValue = isBroadcastQualityLevel(raw) ? raw : getServerSnapshot();
  return cachedValue;
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // O evento `storage` do browser é a notificação de mudança em OUTRA aba.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useBroadcastQuality() {
  const level = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const setQuality = useCallback((next: BroadcastQualityLevel) => {
    if (!isBroadcastQualityLevel(next)) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // QuotaExceededError ou security error. A preferência vale para a sessão
      // corrente de qualquer forma, porque o snapshot já muda ao re-renderizar.
    }
    // O evento `storage` não dispara em quem escreveu: notificar os assinantes
    // é o que faz esta aba reler.
    for (const listener of listeners) listener();
  }, []);

  return { level, setQuality };
}
