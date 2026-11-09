import { useCallback, useRef } from "react";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { RoomStorage } from "@/liveblocks.config";

type Listener = (payload: { event: unknown }) => void;

export const lb = {
  video: null as RoomStorage["video"] | null,
  player: null as RoomStorage["player"] | null,
  commits: [] as RoomStorage["player"][],
  broadcast: vi.fn(),
  listener: null as Listener | null,
  reset() {
    lb.video = null;
    lb.player = null;
    lb.commits = [];
    lb.broadcast.mockClear();
    lb.listener = null;
  },
  emit(event: unknown) {
    act(() => {
      lb.listener?.({ event });
    });
  },
};

const storage = {
  update(patch: { player: RoomStorage["player"] }) {
    lb.commits.push(patch.player);
  },
};

export function liveblocksModule() {
  return {
    useStorage: (selector: (root: Record<string, unknown>) => unknown) =>
      selector({ video: lb.video, player: lb.player }),
    useBroadcastEvent: () => lb.broadcast,
    useEventListener: (fn: Listener) => {
      lb.listener = fn;
    },
    useMutation: (callback: (ctx: unknown, ...args: unknown[]) => unknown) => {
      const latest = useRef(callback);
      latest.current = callback;
      return useCallback((...args: unknown[]) => latest.current({ storage }, ...args), []);
    },
  };
}

export const NOW = 1_700_000_000_000;

export function videoOf(
  source: NonNullable<RoomStorage["video"]["source"]>,
  embedUrl: string,
  loadedAt = 1,
): RoomStorage["video"] {
  return { source, embedUrl, sourceUrl: embedUrl, loadedAt };
}

export function snapshotOf(partial: Partial<RoomStorage["player"]> = {}): RoomStorage["player"] {
  return { isPlaying: false, currentTime: 0, updatedAt: NOW, lastActorId: "other", ...partial };
}
