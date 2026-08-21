"use client";

import { useEffect, useState } from "react";
import { useOthers } from "@liveblocks/react";
import type { PlayerEvent } from "@/liveblocks.config";

const VISIBLE_MS = 6000;

const VERB: Record<PlayerEvent["type"], string> = {
  PLAY: "deu play",
  PAUSE: "pausou",
  SEEK: "mudou a posição",
  LOAD_VIDEO: "carregou um vídeo",
};

// `storage.player.lastActorId` já existia e nunca era lido por componente
// nenhum: numa sala onde qualquer um controla o player, o vídeo parar sem
// explicação é o evento mais confuso do produto (achado 28 da auditoria).
// Fica aqui, e não em RoomExperience, pra manter a assinatura de `useOthers`
// fora do componente que renderiza a sala inteira.
export function LastActionNote({
  lastEvent,
  userId,
}: {
  lastEvent: PlayerEvent | null;
  userId: string;
}) {
  const others = useOthers();
  // guarda qual evento JÁ expirou, em vez de qual está visível: assim o
  // setState acontece só dentro do callback do timeout (assíncrono), nunca no
  // corpo do efeito — mesma restrição que PlayerShell já respeita.
  const [expiredTs, setExpiredTs] = useState<number | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    const ts = lastEvent.ts;
    const t = window.setTimeout(() => setExpiredTs(ts), VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [lastEvent]);

  if (!lastEvent || expiredTs === lastEvent.ts) return null;

  const actorId = "actorId" in lastEvent ? lastEvent.actorId : null;
  if (!actorId) return null;

  const name =
    actorId === userId
      ? "você"
      : others.find((other) => other.presence?.userId === actorId)?.presence.name ?? "alguém";

  return (
    <p className="text-xs text-[var(--ink-muted)]">
      {name} {VERB[lastEvent.type]}
    </p>
  );
}
