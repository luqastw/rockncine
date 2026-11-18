"use client";

import { useCallback, useState } from "react";
import { useMyPresence, useOthers } from "@liveblocks/react";
import { ChevronDownIcon } from "@/components/room/player/icons";
import { Avatar } from "@/components/room/Avatar";
import { parseAvatarVersion } from "@/lib/avatar";

type OtherPresence = {
  presence?: { userId: string; name: string; avatarV?: number | null } | null;
};

function uniqueOthers(others: readonly OtherPresence[], myUserId: string) {
  const byUser = new Map<string, { name: string; avatarV: number | undefined }>();
  for (const other of others) {
    const id = other.presence?.userId;
    if (!id || id === myUserId) continue;
    byUser.set(id, {
      name: other.presence?.name ?? "",
      avatarV: parseAvatarVersion(other.presence?.avatarV),
    });
  }
  return byUser;
}

export function usePresenceDisclosure() {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  return { expanded, toggle };
}

export function PresenceTrigger({
  expanded,
  onToggle,
  myUserId,
  myAvatarV,
}: {
  expanded: boolean;
  onToggle: () => void;
  myUserId: string;
  myName: string;
  myAvatarV?: number | null;
}) {
  const others = useOthers();
  const [myPresence] = useMyPresence();
  const myId = myPresence.userId ?? myUserId;
  const byUser = uniqueOthers(others, myId);
  const total = byUser.size + 1;
  const stacked = [...byUser].slice(0, 2);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls="presence-list"
      className="flex h-full min-h-11 items-center gap-2.5 rounded-tr-[3px] border-l border-[var(--gold-edge)] px-3.5 text-body-sm text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--fill-1)] aria-expanded:bg-[var(--fill-2)] reticle"
    >
      <span className="flex items-center -space-x-2">
        <span className="rounded-full ring-2 ring-[var(--bg-surface)]">
          <Avatar
            userId={myId}
            avatarV={myAvatarV === undefined ? myPresence.avatarV : myAvatarV}
            size="sm"
          />
        </span>
        {stacked.map(([userId, { avatarV }]) => (
          <span key={userId} className="rounded-full ring-2 ring-[var(--bg-surface)]">
            <Avatar userId={userId} avatarV={avatarV} size="sm" />
          </span>
        ))}
      </span>
      <span className="text-caption text-[var(--ink-muted)]">{total} na sala</span>
      <ChevronDownIcon
        className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function PresenceList({
  expanded,
  myUserId,
  myName,
  myAvatarV,
}: {
  expanded: boolean;
  myUserId: string;
  myName: string;
  myAvatarV?: number | null;
}) {
  const others = useOthers();
  const [myPresence] = useMyPresence();
  const byUser = uniqueOthers(others, myPresence.userId ?? myUserId);
  const myId = myPresence.userId ?? myUserId;

  return (
    <ul
      id="presence-list"
      className={`max-h-[30dvh] flex-col gap-2 overflow-y-auto ${expanded ? "flex" : "hidden"}`}
    >
      <li className="flex items-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--fill-1)] px-3 py-2 text-body-sm text-[var(--ink)]">
        <Avatar
          userId={myId}
          avatarV={myAvatarV === undefined ? myPresence.avatarV : myAvatarV}
          size="md"
        />
        <span className="min-w-0 truncate">{myPresence.name || myName}</span>
        <span className="text-caption text-[var(--ink-muted)]">(você)</span>
      </li>
      {[...byUser].map(([userId, { name, avatarV }]) => (
        <li
          key={userId}
          className="flex items-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--fill-1)] px-3 py-2 text-body-sm text-[var(--ink)]"
        >
          <Avatar userId={userId} avatarV={avatarV} size="md" />
          <span className="min-w-0 truncate">{name}</span>
        </li>
      ))}
    </ul>
  );
}