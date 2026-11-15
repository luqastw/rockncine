"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Chat } from "@/components/room/Chat";
import { PresenceList, usePresentCount } from "@/components/room/PresenceList";
import { useChatFeed } from "@/hooks/useChatFeed";
import { getChatFeed } from "@/lib/chat-feed";

type TabId = "chat" | "people";

const TABS: readonly TabId[] = ["chat", "people"];

const tabBase =
  "flex min-h-11 items-center gap-2 border-b-2 px-3 text-body-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-offset)]";

function ChatTab({
  active,
  userId,
  roomCode,
  seen,
  className,
  buttonRef,
  onSelect,
}: {
  active: boolean;
  userId: string;
  roomCode: string;
  seen: ReadonlySet<string>;
  className: string;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
}) {
  const feed = useChatFeed(roomCode);
  const unread = active
    ? 0
    : feed.filter(
        (item) => item.type === "CHAT_MESSAGE" && item.authorId !== userId && !seen.has(item.id),
      ).length;

  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id="side-tab-chat"
      aria-selected={active}
      aria-controls="side-panel-chat"
      aria-label={unread > 0 ? `chat, ${unread} ${unread === 1 ? "não lida" : "não lidas"}` : undefined}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={className}
    >
      chat
      {unread > 0 && (
        <span
          aria-hidden
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--leaf)] px-1.5 text-micro font-bold text-[var(--invert-fg)]"
        >
          {unread}
        </span>
      )}
    </button>
  );
}

export function SidePanel({
  userId,
  userName,
  avatarV,
  roomCode,
  className,
}: {
  userId: string;
  userName: string;
  avatarV?: number | null;
  roomCode: string;
  className?: string;
}) {
  const [active, setActive] = useState<TabId>("chat");
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ chat: null, people: null });
  const presentCount = usePresentCount(userId);

  function select(next: TabId) {
    if (next === active) return;
    if (next === "people") setSeen(new Set(getChatFeed(roomCode).map((item) => item.id)));
    setActive(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.indexOf(active);
    const target =
      event.key === "ArrowRight"
        ? TABS[(index + 1) % TABS.length]
        : event.key === "ArrowLeft"
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === "Home"
            ? TABS[0]
            : event.key === "End"
              ? TABS[TABS.length - 1]
              : null;
    if (!target) return;
    event.preventDefault();
    select(target);
    refs.current[target]?.focus();
  }

  function tabClass(id: TabId) {
    return `${tabBase} ${
      active === id
        ? "border-[var(--leaf)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
    }`;
  }

  return (
    <section className={className}>
      <div role="tablist" aria-label="painel lateral" onKeyDown={onKeyDown} className="flex gap-1">
        <ChatTab
          active={active === "chat"}
          userId={userId}
          roomCode={roomCode}
          seen={seen}
          className={tabClass("chat")}
          buttonRef={(node) => {
            refs.current.chat = node;
          }}
          onSelect={() => select("chat")}
        />
        <button
          ref={(node) => {
            refs.current.people = node;
          }}
          type="button"
          role="tab"
          id="side-tab-people"
          aria-selected={active === "people"}
          aria-controls="side-panel-people"
          tabIndex={active === "people" ? 0 : -1}
          onClick={() => select("people")}
          className={tabClass("people")}
        >
          {`pessoas (${presentCount})`}
        </button>
      </div>
      <div
        role="tabpanel"
        id="side-panel-chat"
        aria-labelledby="side-tab-chat"
        hidden={active !== "chat"}
        className={active === "chat" ? "mt-3 flex min-h-0 flex-1 flex-col" : undefined}
      >
        <Chat userId={userId} userName={userName} avatarV={avatarV} roomCode={roomCode} />
      </div>
      <div
        role="tabpanel"
        id="side-panel-people"
        aria-labelledby="side-tab-people"
        hidden={active !== "people"}
        className={active === "people" ? "mt-3 flex min-h-0 flex-1 flex-col" : undefined}
      >
        <PresenceList expanded myUserId={userId} myName={userName} myAvatarV={avatarV} />
      </div>
    </section>
  );
}
