"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const IDLE_HIDE_MS = 2500;
export const IDLE_HOLD_ATTRIBUTE = "data-idle-hold";

export function hasActiveHold(root: ParentNode | null): boolean {
  if (!root) return false;
  const active = document.activeElement;
  return Array.from(root.querySelectorAll(`[${IDLE_HOLD_ATTRIBUTE}]`)).some(
    (el) =>
      el.matches(":hover") ||
      (active !== null && el.contains(active) && active.matches(":focus-visible")),
  );
}

export function useIdleHide({
  enabled,
  isHeld,
  delay = IDLE_HIDE_MS,
}: {
  enabled: boolean;
  isHeld?: () => boolean;
  delay?: number;
}) {
  const [idleFlag, setIdleFlag] = useState(false);
  const armRef = useRef<() => void>(() => {});
  const heldRef = useRef(isHeld);

  useEffect(() => {
    heldRef.current = isHeld;
  }, [isHeld]);

  useEffect(() => {
    if (!enabled) {
      armRef.current = () => {};
      return;
    }
    let timer: number | null = null;
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const arm = () => {
      clear();
      timer = window.setTimeout(() => {
        timer = null;
        if (heldRef.current?.()) {
          arm();
          return;
        }
        setIdleFlag(true);
      }, delay);
    };
    armRef.current = arm;
    arm();
    const reset = window.setTimeout(() => setIdleFlag(false), 0);
    return () => {
      clear();
      window.clearTimeout(reset);
      armRef.current = () => {};
    };
  }, [enabled, delay]);

  const wake = useCallback(() => {
    setIdleFlag(false);
    armRef.current();
  }, []);

  return { idle: enabled && idleFlag, wake };
}
