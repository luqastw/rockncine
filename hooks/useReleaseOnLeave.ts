"use client";

import { useEffect } from "react";
import { useMutation, useOthers } from "@liveblocks/react";

export function useReleaseOnLeave() {
  const othersCount = useOthers((others) => others.length);

  // se eu for o último a sair, devolvo o storage pra "pausado". Só quando não
  // há mais ninguém: zerar o flag com gente assistindo faria a correção de
  // drift dos outros puxar o vídeo de volta.
  const releasePlayingFlag = useMutation(({ storage }) => {
    const snapshot = storage.get("player");
    if (!snapshot?.isPlaying) return;
    storage.update({ player: { ...snapshot, isPlaying: false, updatedAt: Date.now() } });
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (othersCount > 0) return;
      releasePlayingFlag();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [othersCount, releasePlayingFlag]);
}
