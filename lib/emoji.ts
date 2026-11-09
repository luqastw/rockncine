export function isEmojiOnly(text: string): boolean {
  const cleaned = text.replace(/[\s\uFE0F\u200D]/g, "");
  if (cleaned.length === 0 || cleaned.length > 12) return false;
  for (const char of cleaned) {
    const code = char.codePointAt(0) ?? 0;
    const emoji =
      (code >= 0x1f300 && code <= 0x1faff) ||
      (code >= 0x2600 && code <= 0x27bf) ||
      (code >= 0x1f000 && code <= 0x1f2ff) ||
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0x1f3fb && code <= 0x1f3ff);
    if (!emoji) return false;
  }
  return true;
}

export function insertAtCaret(
  current: string,
  emoji: string,
  start: number,
  end: number,
): { next: string; caret: number } {
  return {
    next: current.slice(0, start) + emoji + current.slice(end),
    caret: start + emoji.length,
  };
}
