"use client";

import { useMemo } from "react";
import { PresenceList, PresenceTrigger, usePresenceDisclosure } from "@/components/room/PresenceList";

export function usePresenceAccessory(userId: string, userName: string, avatarV?: number | null) {
  const presence = usePresenceDisclosure();

  return useMemo(
    () => (
      <div className="relative h-full">
        <PresenceTrigger
          expanded={presence.expanded}
          onToggle={presence.toggle}
          myUserId={userId}
          myName={userName}
          myAvatarV={avatarV}
        />
        <div
          className={`absolute right-0 top-full z-40 w-64 rounded-sm border border-[var(--line)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-pop)] ${
            presence.expanded ? "block" : "hidden"
          }`}
        >
          <PresenceList expanded={presence.expanded} myUserId={userId} myName={userName} myAvatarV={avatarV} />
        </div>
      </div>
    ),
    [presence.expanded, presence.toggle, userId, userName, avatarV],
  );
}
