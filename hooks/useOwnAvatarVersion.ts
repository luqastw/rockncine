"use client";

import { useEffect, useRef, useState } from "react";
import { useUpdateMyPresence } from "@liveblocks/react";
import { parseAvatarVersion } from "@/lib/avatar";

const CHANNEL_NAME = "rockncine:avatar";
const IMAGE_ENDPOINT = "/api/profile/image";

function readVersion(value: unknown): number | null | undefined {
  if (value === null) return null;
  return parseAvatarVersion(value);
}

function readMessage(data: unknown): number | null | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("v" in data)) return undefined;
  return readVersion((data as { v: unknown }).v);
}

export function useOwnAvatarVersion(
  initial: number | null | undefined,
): number | null | undefined {
  const [version, setVersion] = useState<number | null | undefined>(initial);
  const updateMyPresence = useUpdateMyPresence();
  const current = useRef(version);
  const previous = useRef(version);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    current.current = version;
    if (previous.current === version) return;
    previous.current = version;
    if (version === undefined) return;
    updateMyPresence({ avatarV: version });
  }, [version, updateMyPresence]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return;
    }
    channel.onmessage = (event: MessageEvent) => {
      const next = readMessage(event.data);
      if (next === undefined) return;
      generation.current += 1;
      current.current = next;
      setVersion(next);
    };
    return () => {
      channel.onmessage = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function recheck() {
      if (inFlight.current) return;
      inFlight.current = true;
      const startedAt = generation.current;
      try {
        const response = await fetch(IMAGE_ENDPOINT, { cache: "no-store" });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!active || generation.current !== startedAt) return;
        const next = readMessage(body);
        if (next === undefined || next === current.current) return;
        generation.current += 1;
        current.current = next;
        setVersion(next);
      } catch {
        return;
      } finally {
        inFlight.current = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      void recheck();
    }

    function onFocus() {
      void recheck();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return version;
}
