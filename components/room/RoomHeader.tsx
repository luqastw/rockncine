"use client";

import Link from "next/link";
import { useState } from "react";
import { useStatus } from "@liveblocks/react";
import type { BroadcastState, PlayerEvent } from "@/liveblocks.config";
import { AsciiKorok } from "@/components/chrome/AsciiKorok";
import { InviteCode } from "@/components/room/InviteCode";
import { LastActionNote } from "@/components/room/LastActionNote";
import { BroadcastControls } from "@/components/room/BroadcastControls";
import { RoomActions } from "@/components/room/RoomActions";
import { ProfileAvatarModal } from "@/components/room/ProfileAvatarModal";
import { Badge } from "@/components/ui/Badge";
import { iconButtonClass } from "@/components/ui/IconButton";

const CONNECTION_LABEL: Partial<Record<ReturnType<typeof useStatus>, string>> = {
  initial: "conectando…",
  connecting: "conectando…",
  reconnecting: "reconectando…",
  disconnected: "desconectado — tentando religar…",
};

export function RoomHeader({
  roomCode,
  roomName,
  userId,
  userName,
  avatarV,
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
  avatarV?: number | null;
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
  const [profileOpen, setProfileOpen] = useState(false);
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
        <AsciiKorok variant="mini" className="max-sm:hidden" />
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
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:mr-3 lg:w-auto">
        <div className="min-w-0 max-sm:flex-1 max-sm:[&>div]:w-full max-sm:[&>div]:justify-between">
          <InviteCode code={roomCode} />
        </div>
        {livekitUrl !== null && (
          <BroadcastControls
            broadcast={broadcast}
            userId={userId}
            userName={userName}
            videoSourceUrl={videoSourceUrl}
          />
        )}
        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="imagem de perfil"
            aria-haspopup="dialog"
            className={iconButtonClass({ variant: "outline", className: "shrink-0" })}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </button>
          <RoomActions
            onLoadVideo={onLoadVideo}
            onToggleTheater={onToggleTheater}
            isTheater={isTheater}
            showTheaterToggle={isFullscreen}
            onToggleEconomy={onToggleEconomy}
            isEconomy={economyMode}
          />
        </div>
      </div>
      <ProfileAvatarModal
        userId={userId}
        avatarV={avatarV ?? null}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </header>
  );
}
