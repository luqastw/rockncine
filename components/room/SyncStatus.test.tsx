import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerEvent } from "@/liveblocks.config";
import { SyncStatus } from "./SyncStatus";

const base = { isPlaying: false, isBroadcasting: false, syncLimited: false, lastEvent: null };

function event(ts: number): PlayerEvent {
  return { type: "PAUSE", actorId: "u", ts } as PlayerEvent;
}

describe("SyncStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tocando mostra ao vivo e o ponto", () => {
    const { container } = render(<SyncStatus {...base} isPlaying />);
    expect(screen.getByText("ao vivo")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(container.querySelector("[data-sync-dot]")).not.toBeNull();
  });

  it("pausado mostra pausado sem ponto", () => {
    const { container } = render(<SyncStatus {...base} />);
    expect(screen.getByText("pausado")).toBeTruthy();
    expect(container.querySelector("[data-sync-dot]")).toBeNull();
  });

  it("transmissão mostra transmissão sem ponto", () => {
    const { container } = render(<SyncStatus {...base} isPlaying isBroadcasting />);
    expect(screen.getByText("transmissão")).toBeTruthy();
    expect(container.querySelector("[data-sync-dot]")).toBeNull();
  });

  it("preserva o rótulo de conexão", () => {
    render(<SyncStatus {...base} connectionLabel="conectando…" />);
    expect(screen.getAllByText("conectando…")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("conectando…");
  });

  it("acende o pentagrama por 380ms a cada evento", () => {
    const { container, rerender } = render(<SyncStatus {...base} />);
    const staff = () => container.querySelector("[data-lit]")?.getAttribute("data-lit");
    expect(staff()).toBe("false");
    rerender(<SyncStatus {...base} lastEvent={event(1)} />);
    expect(staff()).toBe("true");
    act(() => {
      vi.advanceTimersByTime(380);
    });
    expect(staff()).toBe("false");
  });
});
