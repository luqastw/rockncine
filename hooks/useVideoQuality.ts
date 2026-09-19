"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FPS_LIMITS, RESOLUTIONS, type FpsLimit, type Resolution } from "@/lib/playback/types";

const STORAGE_KEY = "rockncine-video-quality";

interface StoredQuality {
  resolution: Resolution;
  fpsLimit: FpsLimit;
  economyMode: boolean;
  economySuggestionDismissed: boolean;
}

export function detectLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.hardwareConcurrency <= 2) return true;
  if ("deviceMemory" in navigator && (navigator as { deviceMemory?: number }).deviceMemory! < 4)
    return true;
  return false;
}

export function detectSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function getServerSnapshot(): StoredQuality {
  return { resolution: "720p", fpsLimit: "auto", economyMode: false, economySuggestionDismissed: false };
}

// Valida o que veio do localStorage em vez de confiar num cast. Um valor
// legado/corrompido (ex.: `resolution: "1080p"` de uma versão futura, ou o
// objeto inteiro trocado por um array) passava direto pelo `as StoredQuality`
// e virava `undefined` em RESOLUTION_MAX_HEIGHT — desligando o teto de
// qualidade em silêncio, sem erro nenhum. Cada campo inválido cai no default.
export function parseStoredQuality(raw: unknown): StoredQuality {
  const base = getServerSnapshot();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  const value = raw as Record<string, unknown>;
  const resolution = RESOLUTIONS.includes(value.resolution as Resolution)
    ? (value.resolution as Resolution)
    : base.resolution;
  const fpsLimit = FPS_LIMITS.includes(value.fpsLimit as FpsLimit)
    ? (value.fpsLimit as FpsLimit)
    : base.fpsLimit;

  return {
    resolution,
    fpsLimit,
    economyMode: typeof value.economyMode === "boolean" ? value.economyMode : base.economyMode,
    economySuggestionDismissed:
      typeof value.economySuggestionDismissed === "boolean"
        ? value.economySuggestionDismissed
        : base.economySuggestionDismissed,
  };
}

export function readStorage(): StoredQuality {
  if (typeof window === "undefined") return getServerSnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getServerSnapshot();
    return parseStoredQuality(JSON.parse(raw));
  } catch {
    return getServerSnapshot();
  }
}

export function saveStoredQuality(data: StoredQuality): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // QuotaExceededError or security error — swallow silently
  }
}

// --- store externo -------------------------------------------------------------------
// As preferências vivem fora do React (localStorage) e são lidas no cliente.
// `useSyncExternalStore` é o que resolve os dois problemas de uma vez:
//   - hidratação: o React usa `getServerSnapshot` no HTML do servidor e no
//     primeiro render do cliente, e só depois troca pelo valor real. Ler o
//     localStorage direto no render (o que era feito antes) fazia o HTML do
//     servidor divergir do primeiro render do cliente — hydration mismatch
//     para qualquer usuário que já tivesse mexido nas preferências.
//   - abas abertas: o evento `storage` do browser já é a notificação de que o
//     valor mudou em outra aba.
const listeners = new Set<() => void>();

// `getSnapshot` precisa devolver valor referencialmente estável, senão o React
// re-renderiza em loop. O cache é chaveado pela string crua: só muda quando o
// conteúdo do localStorage muda.
let cachedRaw: string | null | undefined;
let cachedValue: StoredQuality = getServerSnapshot();

function getClientSnapshot(): StoredQuality {
  if (typeof window === "undefined") return getServerSnapshot();

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  try {
    cachedValue = raw ? parseStoredQuality(JSON.parse(raw)) : getServerSnapshot();
  } catch {
    cachedValue = getServerSnapshot();
  }
  return cachedValue;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

// `navigator` não muda durante a sessão: subscribe vazio, e o snapshot do
// servidor é sempre `false` (que é o que o HTML pré-renderizado contém).
const subscribeNothing = () => () => {};
const serverFalse = () => false;

export function useVideoQuality() {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const isLowEnd = useSyncExternalStore(subscribeNothing, detectLowEndDevice, serverFalse);
  const isSafari = useSyncExternalStore(subscribeNothing, detectSafari, serverFalse);

  const updateStorage = useCallback((patch: Partial<StoredQuality>) => {
    saveStoredQuality({ ...readStorage(), ...patch });
    // O cache é invalidado pela própria mudança da string crua; notificar os
    // assinantes é o que faz o React reler e re-renderizar nesta aba (o evento
    // `storage` do browser não dispara em quem escreveu).
    for (const listener of listeners) listener();
  }, []);

  const setResolution = useCallback(
    (r: Resolution) => {
      updateStorage({ resolution: r });
    },
    [updateStorage],
  );

  const setFpsLimit = useCallback(
    (f: FpsLimit) => {
      updateStorage({ fpsLimit: f });
    },
    [updateStorage],
  );

  const setEconomyMode = useCallback(
    (e: boolean) => {
      updateStorage({ economyMode: e });
    },
    [updateStorage],
  );

  const dismissSuggestion = useCallback(() => {
    updateStorage({ economySuggestionDismissed: true });
  }, [updateStorage]);

  return {
    resolution: state.resolution,
    fpsLimit: state.fpsLimit,
    economyMode: state.economyMode,
    setResolution,
    setFpsLimit,
    setEconomyMode,
    isLowEnd,
    isSafari,
    hasSeenSuggestion: state.economySuggestionDismissed,
    dismissSuggestion,
  };
}
