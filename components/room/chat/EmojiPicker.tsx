import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { REACTION_EMOJIS } from "@/liveblocks.config";
import { inputClass } from "@/components/ui/Input";
import {
  EMOJI_CATEGORIES,
  nomeDoEmoji,
  searchEmojis,
  type EmojiEntry,
} from "@/components/room/chat/emojiData";
import { columnsOf, nextIndex } from "@/components/room/chat/emojiNavigation";
import { loadRecents, pushRecent, saveRecents } from "@/components/room/chat/recentEmojis";

const DESKTOP_COLUMNS = 7;

type CellProps = {
  entry: EmojiEntry;
  active: boolean;
  onFocusCell: () => void;
  onPick: (emoji: string) => void;
};

function Cell({ entry, active, onFocusCell, onPick }: CellProps) {
  return (
    <button
      type="button"
      data-cell=""
      data-emoji={entry.emoji}
      tabIndex={active ? 0 : -1}
      aria-label={`Inserir ${entry.nome}`}
      onFocus={onFocusCell}
      onClick={() => onPick(entry.emoji)}
      className="flex h-[var(--emoji-cell)] w-[var(--emoji-cell)] items-center justify-center rounded-sm text-xl hover:bg-[var(--bg-elevated)] reticle"
    >
      {entry.emoji}
    </button>
  );
}

function focusCell(container: HTMLElement | null, index: number) {
  const cells = container?.querySelectorAll<HTMLButtonElement>("[data-cell]");
  cells?.[index]?.focus();
}

export function EmojiPicker({
  id,
  onPick,
}: {
  id: string;
  onPick: (emoji: string) => void;
}) {
  const [stored] = useState<string[]>(() => loadRecents());
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const [recentIndex, setRecentIndex] = useState(0);
  const [gridIndex, setGridIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const recentsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<string[]>(stored);
  const baseId = useId();

  const recents = stored.length > 0 ? stored : [...REACTION_EMOJIS];
  const searching = query.trim().length > 0;
  const category = EMOJI_CATEGORIES.find((item) => item.id === categoryId) ?? EMOJI_CATEGORIES[0];
  const results = useMemo(() => (searching ? searchEmojis(query) : []), [query, searching]);
  const entries = searching ? results : category.emojis;
  const heading = searching ? "Resultados" : category.label;

  useEffect(() => {
    const isDesktop = typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      searchRef.current?.focus();
      return;
    }
    focusCell(recentsRef.current, 0);
  }, []);

  const pick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      pendingRef.current = pushRecent(pendingRef.current, emoji);
      saveRecents(pendingRef.current);
    },
    [onPick],
  );

  const handleRecentsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const visible = Math.min(recents.length, columnsOf(recentsRef.current, DESKTOP_COLUMNS));
    const next = nextIndex(event.key, recentIndex, visible, visible);
    if (next === null) return;
    event.preventDefault();
    setRecentIndex(next);
    focusCell(recentsRef.current, next);
  };

  const handleGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextIndex(event.key, gridIndex, entries.length, columnsOf(gridRef.current, DESKTOP_COLUMNS));
    if (next === null) return;
    event.preventDefault();
    setGridIndex(next);
    focusCell(gridRef.current, next);
  };

  const handleTabsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = EMOJI_CATEGORIES.findIndex((item) => item.id === categoryId);
    const next = nextIndex(event.key, current, EMOJI_CATEGORIES.length, EMOJI_CATEGORIES.length);
    if (next === null || event.key === "ArrowDown" || event.key === "ArrowUp") return;
    event.preventDefault();
    setCategoryId(EMOJI_CATEGORIES[next].id);
    setGridIndex(0);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    focusCell(gridRef.current, gridIndex);
  };

  const panelId = `${baseId}-grid`;

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Emojis"
      className="frame flex flex-col gap-2 px-4 pt-4 pb-3 [--emoji-cell:2.75rem]"
    >
      <div className="border-b border-[var(--gold-edge)] pb-2">
        <div
          ref={recentsRef}
          role="group"
          aria-label="Emojis recentes"
          onKeyDown={handleRecentsKey}
          className="grid grid-cols-7 max-lg:grid-cols-8 lg:[&>:nth-child(n+8)]:hidden"
        >
          {recents.map((emoji, index) => (
            <Cell
              key={emoji}
              entry={{ emoji, nome: nomeDoEmoji(emoji) }}
              active={index === recentIndex}
              onFocusCell={() => setRecentIndex(index)}
              onPick={pick}
            />
          ))}
        </div>
      </div>

      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setGridIndex(0);
        }}
        onKeyDown={handleSearchKey}
        placeholder="Buscar emoji"
        aria-label="Buscar emoji"
        autoComplete="off"
        className={inputClass({ className: "min-h-10 py-1.5" })}
      />

      {!searching && (
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Categorias de emoji"
          onKeyDown={handleTabsKey}
          className="flex border-b border-[var(--line)]"
        >
          {EMOJI_CATEGORIES.map((item) => {
            const selected = item.id === categoryId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                aria-label={item.label}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setCategoryId(item.id);
                  setGridIndex(0);
                }}
                className="flex h-10 min-w-0 flex-1 items-center justify-center border-b-2 border-transparent text-lg opacity-60 transition-opacity duration-150 hover:opacity-100 aria-selected:border-[var(--gold)] aria-selected:opacity-100 reticle"
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      )}

      <div id={panelId} role={searching ? "region" : "tabpanel"} aria-label={heading} className="flex min-h-0 flex-col">
                {entries.length === 0 ? (
          <p role="status" className="py-4 text-center text-caption text-[var(--ink-muted)]">
            Nenhum emoji encontrado
          </p>
        ) : (
          <div
            ref={gridRef}
            onKeyDown={handleGridKey}
            className="grid max-h-[calc(var(--emoji-cell)*3)] grid-cols-7 overflow-y-auto max-lg:grid-cols-8"
          >
            {entries.map((entry, index) => (
              <Cell
                key={entry.emoji}
                entry={entry}
                active={index === gridIndex}
                onFocusCell={() => setGridIndex(index)}
                onPick={pick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
