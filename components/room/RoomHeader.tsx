"use client";

import Link from "next/link";
import { useState } from "react";
import { useStatus } from "@liveblocks/react";
import type { BroadcastState, PlayerEvent } from "@/liveblocks.config";
import { InviteCode } from "@/components/room/InviteCode";
import { LastActionNote } from "@/components/room/LastActionNote";
import { SyncStatus } from "@/components/room/SyncStatus";
import { BroadcastControls } from "@/components/room/BroadcastControls";
import { RoomActions } from "@/components/room/RoomActions";
import { ProfileAvatarModal } from "@/components/room/ProfileAvatarModal";
import { Badge } from "@/components/ui/Badge";
import { iconButtonClass } from "@/components/ui/IconButton";
import { ArrowLeftIcon, MoreIcon } from "@/components/room/player/icons";

const TOOLS_ID = "room-header-tools";

const CONNECTION_LABEL: Partial<Record<ReturnType<typeof useStatus>, string>> = {
  initial: "Conectando…",
  connecting: "Conectando…",
  reconnecting: "Reconectando…",
  disconnected: "Desconectado — tentando religar…",
};

export function RoomHeader({
  roomCode,
  roomName,
  userId,
  userName,
  avatarV,
  livekitUrl,
  broadcast,
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const connectionLabel = CONNECTION_LABEL[status];

  return (
    <header className="relative flex items-center gap-2 border-b border-[var(--gold-edge)] pb-3 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-4 sm:min-w-[11rem] sm:gap-5">
        <Link
          href="/rooms"
          aria-label="Voltar para suas salas"
          title="Voltar para suas salas"
          className={iconButtonClass({
            variant: "ghost",
            className:
              "shrink-0 border-[var(--gold-edge)] bg-[var(--bg-surface)] hover:border-[var(--gold)] hover:text-[var(--gold-hi)] hover:shadow-[0_0_14px_color-mix(in_srgb,var(--gold)_28%,transparent)]",
          })}
        >
          <ArrowLeftIcon className="size-5" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate font-display text-heading font-semibold tracking-tight text-[var(--ink)] sm:text-title">
              {roomName || "Sala sem nome"}
            </h1>
            {economyMode && <Badge variant="soft">Economy</Badge>}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
            <LastActionNote lastEvent={lastEvent} userId={userId} />
            <SyncStatus
              isPlaying={isPlayingNow}
              isBroadcasting={isBroadcasting}
              syncLimited={syncLimited}
              lastEvent={lastEvent}
              connectionLabel={connectionLabel}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setToolsOpen((open) => !open)}
        aria-label="Mais opções da sala"
        aria-expanded={toolsOpen}
        aria-controls={TOOLS_ID}
        className={iconButtonClass({ variant: "ghost", className: "shrink-0 sm:hidden" })}
      >
        <MoreIcon className="size-5" />
      </button>

      <div
        id={TOOLS_ID}
        className={`${toolsOpen ? "flex" : "hidden"} z-30 flex-col items-stretch gap-3 max-sm:absolute max-sm:top-full max-sm:right-0 max-sm:mt-2 max-sm:w-[min(20rem,calc(100vw-1.5rem))] max-sm:rounded-sm max-sm:border max-sm:border-[var(--gold-edge)] max-sm:bg-[var(--bg-surface)] max-sm:p-4 max-sm:shadow-[var(--shadow-lg)] sm:flex sm:shrink-0 sm:flex-row sm:items-center sm:gap-2`}
      >
        <InviteCode code={roomCode} />
        {livekitUrl !== null && (
          <BroadcastControls
            broadcast={broadcast}
            userId={userId}
            userName={userName}
          />
        )}
        <RoomActions
          onLoadVideo={onLoadVideo}
          onToggleTheater={onToggleTheater}
          isTheater={isTheater}
          showTheaterToggle={isFullscreen}
          onToggleEconomy={onToggleEconomy}
          isEconomy={economyMode}
          onOpenProfile={() => setProfileOpen(true)}
        />
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
