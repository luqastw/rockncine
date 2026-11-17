export function nextIndex(key: string, index: number, count: number, columns: number): number | null {
  if (count === 0) return null;
  const last = count - 1;
  if (key === "ArrowRight") return Math.min(index + 1, last);
  if (key === "ArrowLeft") return Math.max(index - 1, 0);
  if (key === "ArrowDown") return index + columns <= last ? index + columns : index;
  if (key === "ArrowUp") return index - columns >= 0 ? index - columns : index;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

export function columnsOf(element: HTMLElement | null, fallback: number): number {
  if (!element) return fallback;
  const template = window.getComputedStyle(element).gridTemplateColumns;
  const count = template.split(" ").filter((part) => part && part !== "none").length;
  return count || fallback;
}
