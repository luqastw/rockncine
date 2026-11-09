import { useCallback, useEffect, useRef } from "react";

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as PromiseLike<unknown>).then === "function";
}

export function useApplyRemote({
  cooldownMs,
  awaitPromise = false,
}: {
  cooldownMs: number;
  awaitPromise?: boolean;
}) {
  const isApplyingRemoteRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const cancelPending = useCallback(() => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const applyRemote = useCallback(
    (fn: () => unknown) => {
      cancelPending();
      const generation = ++generationRef.current;
      isApplyingRemoteRef.current = true;
      const result = fn();
      const release = () => {
        if (generation !== generationRef.current) return;
        isApplyingRemoteRef.current = false;
      };
      if (awaitPromise && isThenable(result)) {
        result.then(release, release);
        return;
      }
      timeoutRef.current = window.setTimeout(release, cooldownMs);
    },
    [cooldownMs, awaitPromise, cancelPending],
  );

  useEffect(
    () => () => {
      cancelPending();
      generationRef.current += 1;
      isApplyingRemoteRef.current = false;
    },
    [cancelPending],
  );

  return { applyRemote, isApplyingRemoteRef };
}
