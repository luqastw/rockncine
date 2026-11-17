"use client";

import { useMemo } from "react";
import { PresenceList, PresenceTrigger, usePresenceDisclosure } from "@/components/room/PresenceList";

export function usePresenceAccessory(userId: string, userName: string, avatarV?: number | null) {
  const presence = usePresenceDisclosure();

  // Elemento estável passado ao `<Chat>`: como o objeto é o mesmo entre renders
  // da sala, o React pula a subárvore da presença quando o log ou o draft do
  // chat mudam. É o que preserva o isolamento de render da spec 13 mesmo com o
  // gatilho dentro do painel do chat.
  return useMemo(
    () => (
      <div className="relative">
        <PresenceTrigger
          expanded={presence.expanded}
          onToggle={presence.toggle}
          myUserId={userId}
          myName={userName}
          myAvatarV={avatarV}
        />
        <div
          className={`absolute right-0 top-full z-40 mt-2 w-64 rounded-sm border border-[var(--line)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-pop)] ${
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
