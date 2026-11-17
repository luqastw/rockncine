export const RECENT_EMOJIS_KEY = "rockncine:emoji-recentes";
export const RECENT_EMOJIS_LIMIT = 8;

export function pushRecent(list: readonly string[], emoji: string): string[] {
  return [emoji, ...list.filter((item) => item !== emoji)].slice(0, RECENT_EMOJIS_LIMIT);
}

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || item.length > 16) continue;
    if (result.includes(item)) continue;
    result.push(item);
  }
  return result.slice(0, RECENT_EMOJIS_LIMIT);
}

export function loadRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRecents(list: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(list.slice(0, RECENT_EMOJIS_LIMIT)));
  } catch {
    return;
  }
}
