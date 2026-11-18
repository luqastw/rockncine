"use client";

import { memo } from "react";
import { LeafIcon, PlusIcon, TheaterIcon, UserIcon } from "@/components/room/player/icons";
import { CHAT_PANEL_ID } from "@/components/room/chat/ids";
import { buttonClass } from "@/components/ui/Button";
import { iconButtonClass } from "@/components/ui/IconButton";

const ECONOMY_BASE =
  "shrink-0 border transition-[color,background-color,border-color,box-shadow] duration-[calc(var(--motion-dur)*var(--motion-factor))]";
const ECONOMY_IDLE = "border-[var(--line)]";
const ECONOMY_LIT =
  "border-[var(--leaf)] bg-[color-mix(in_srgb,var(--leaf)_16%,var(--bg-surface))] text-[var(--leaf-ink)] shadow-[inset_0_0_14px_color-mix(in_srgb,var(--leaf)_38%,transparent),0_0_12px_color-mix(in_srgb,var(--leaf)_24%,transparent)] hover:bg-[color-mix(in_srgb,var(--leaf)_22%,var(--bg-surface))] hover:text-[var(--leaf-ink)]";

export const RoomActions = memo(function RoomActions({
  onLoadVideo,
  onToggleTheater,
  isTheater,
  showTheaterToggle,
  onToggleEconomy,
  isEconomy,
  onOpenProfile,
}: {
  onLoadVideo: () => void;
  onToggleTheater: () => void;
  isTheater: boolean;
  showTheaterToggle: boolean;
  onToggleEconomy: () => void;
  isEconomy: boolean;
  onOpenProfile?: () => void;
}) {
  const economyLabel = isEconomy ? "Desativar modo economy" : "Ativar modo economy";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onOpenProfile && (
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Perfil"
          aria-haspopup="dialog"
          title="Imagem de perfil"
          className={iconButtonClass({ variant: "ghost", className: "shrink-0" })}
        >
          <UserIcon className="size-5" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleEconomy}
        aria-label={economyLabel}
        aria-pressed={isEconomy}
        title={economyLabel}
        data-active={isEconomy}
        className={buttonClass({
          variant: "ghost",
          size: "sm",
          className: `${ECONOMY_BASE} ${isEconomy ? ECONOMY_LIT : ECONOMY_IDLE}`,
        })}
      >
        <LeafIcon className="size-4" />
        <span className="max-sm:inline sm:hidden xl:inline">Economy</span>
      </button>
      <button
        type="button"
        onClick={onLoadVideo}
        aria-label="Carregar vídeo"
        title="Carregar vídeo"
        className={buttonClass({
          variant: "primary",
          size: "sm",
          className: "shrink-0",
        })}
      >
        <PlusIcon className="size-4" />
        <span className="max-sm:inline sm:hidden xl:inline">Carregar vídeo</span>
      </button>
      {showTheaterToggle && (
        <button
          type="button"
          onClick={onToggleTheater}
          aria-label={isTheater ? "Fechar chat" : "Abrir chat"}
          aria-expanded={isTheater}
          aria-controls={CHAT_PANEL_ID}
          title={isTheater ? "Fechar chat" : "Abrir chat"}
          className={iconButtonClass({
            variant: "ghost",
            active: isTheater,
            className: "shrink-0 max-lg:hidden lg:inline-flex",
          })}
        >
          <TheaterIcon className="size-5" />
        </button>
      )}
    </div>
  );
});
