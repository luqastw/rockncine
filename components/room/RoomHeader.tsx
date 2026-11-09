"use client";

import Link from "next/link";
import { useStatus } from "@liveblocks/react";
import type { BroadcastState, PlayerEvent } from "@/liveblocks.config";
import { InviteCode } from "@/components/room/InviteCode";
import { LastActionNote } from "@/components/room/LastActionNote";
import { BroadcastControls } from "@/components/room/BroadcastControls";
import { RoomActions } from "@/components/room/RoomActions";
import { Badge } from "@/components/ui/Badge";
import { iconButtonClass } from "@/components/ui/IconButton";

const CONNECTION_LABEL: Partial<Record<ReturnType<typeof useStatus>, string>> = {
  initial: "conectando...",
  connecting: "conectando...",
  reconnecting: "reconectando...",
  disconnected: "desconectado — tentando religar...",
};

export function RoomHeader({
  roomCode,
  roomName,
  userId,
  userName,
  livekitUrl,
  broadcast,
  videoSourceUrl,
  lastEvent,
  isPlayingNow,
  syncLimited,
  isBroadcasting,
  economyMode,
  isTheater,
  isFullscreen,
  onLoadVideo,
  onToggleTheater,
  onToggleEconomy,
}: {
  roomCode: string;
  roomName: string | null;
  userId: string;
  userName: string;
  livekitUrl: string | null;
  broadcast: BroadcastState | null;
  videoSourceUrl: string | null;
  lastEvent: PlayerEvent | null;
  isPlayingNow: boolean;
  syncLimited: boolean;
  isBroadcasting: boolean;
  economyMode: boolean;
  isTheater: boolean;
  isFullscreen: boolean;
  onLoadVideo: () => void;
  onToggleTheater: () => void;
  onToggleEconomy: () => void;
}) {
  const status = useStatus();
  const connectionLabel = CONNECTION_LABEL[status];

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/rooms"
          aria-label="voltar para suas salas"
          className={iconButtonClass({ variant: "outline", className: "shrink-0" })}
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-heading font-semibold tracking-tight text-[var(--ink)]">
              {roomName || "sala sem nome"}
            </h1>
            {/* `!isBroadcasting`: este selo descreve o player, e no modo
                transmissão o player não está na tela. Deixá-lo aceso sobre a
                transmissão seria um status mentindo sobre o que as pessoas
                estão vendo. */}
            {isPlayingNow && !syncLimited && !isBroadcasting && (
              <Badge variant="solid" className="uppercase tracking-wide">
                ao vivo
              </Badge>
            )}
            {/* Indicador, não controle: quem liga/desliga é o botão de
                `RoomActions` (44px, com `aria-pressed`). */}
            {economyMode && <Badge variant="soft">economy</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LastActionNote lastEvent={lastEvent} userId={userId} />
            {connectionLabel ? (
              <span
                role="status"
                aria-live="polite"
                className="font-mono text-caption text-[var(--ink-muted)]"
              >
                {connectionLabel}
              </span>
            ) : (
              !syncLimited &&
              !isPlayingNow && (
                <span
                  role="status"
                  aria-live="polite"
                  className="font-mono text-caption text-[var(--ink-muted)]"
                >
                  ○ pausado
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Ações da sala no mesmo bloco do convite: no mobile o botão de
          transmissão fica ao lado do código, sem uma linha própria abaixo do
          vídeo. O chat começa na mesma altura da moldura do vídeo. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:mr-3">
        <InviteCode code={roomCode} />
        {livekitUrl !== null && (
          <BroadcastControls
            broadcast={broadcast}
            userId={userId}
            userName={userName}
            videoSourceUrl={videoSourceUrl}
          />
        )}
        <RoomActions
          onLoadVideo={onLoadVideo}
          onToggleTheater={onToggleTheater}
          isTheater={isTheater}
          showTheaterToggle={isFullscreen}
          onToggleEconomy={onToggleEconomy}
          isEconomy={economyMode}
        />
      </div>
    </header>
  );
}
