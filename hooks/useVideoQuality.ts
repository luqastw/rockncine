"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

type Resolution = "720p" | "480p";
type FpsLimit = "auto" | "30" | "60";

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

export function readStorage(): StoredQuality {
  if (typeof window === "undefined") return getServerSnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getServerSnapshot();
    return JSON.parse(raw) as StoredQuality;
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

function getServerSnapshot(): StoredQuality {
  return { resolution: "720p", fpsLimit: "auto", economyMode: false, economySuggestionDismissed: false };
}

export function useVideoQuality() {
  const [state, setState] = useState<StoredQuality>(readStorage);

  useEffect(() => {
    const onStorage = () => setState(readStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateStorage = useCallback(
    (patch: Partial<StoredQuality>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        saveStoredQuality(next);
        return next;
      });
    },
    [],
  );

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

  const isLowEnd = useMemo(() => detectLowEndDevice(), []);
  const isSafari = useMemo(() => detectSafari(), []);

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
