import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemEvent } from "@/liveblocks.config";
import type { PlaybackController } from "@/hooks/playerController";
import { resetChatFeed } from "@/lib/chat-feed";

type Listener = (payload: { event: unknown }) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
}));

vi.mock("@liveblocks/react", () => ({
  useBroadcastEvent: () => vi.fn(),
  useEventListener: (fn: Listener) => {
    mocks.listeners.push(fn);
  },
  useStatus: () => "connected",
  useOthers: () => [],
  useMyPresence: () => [{ userId: "eu", name: "ana" }, vi.fn()],
}));

import { Chat } from "./Chat";
import { PlayerControls } from "./player/PlayerControls";
import { RoomIris } from "./RoomIris";

const controller: PlaybackController = {
  isReady: true,
  isPlaying: false,
  currentTime: 0,
  duration: 100,
  volume: 1,
  isMuted: false,
  error: null,
  resolution: null,
  fpsLimit: "auto" as PlaybackController["fpsLimit"],
  play: vi.fn(),
  pause: vi.fn(),
  togglePlay: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
};

afterEach(() => {
  cleanup();
  mocks.listeners.length = 0;
  resetChatFeed();
});

function renderChat() {
  return render(<Chat userId="eu" userName="ana" roomCode="SALA1234" />);
}

describe("identidade da sala", () => {
  it("AC-013: marcador de diálogo", () => {
    renderChat();
    const event: SystemEvent = {
      type: "SYSTEM_MESSAGE",
      id: "s1",
      text: "bruno entrou na sala",
      ts: Date.now(),
    };
    act(() => {
      for (const fn of mocks.listeners) fn({ event });
    });

    expect(screen.getByText(/bruno entrou na sala/i)).toBeTruthy();
    const marker = screen.getByText("▼");
    expect(marker.getAttribute("aria-hidden")).toBe("true");
  });

  it("AC-007: controles de ícone do player são circulares", () => {
    render(
      <PlayerControls
        controller={controller}
        isFullscreen={false}
        onToggleFullscreen={vi.fn()}
        captions={false}
        onToggleCaptions={vi.fn()}
      />,
    );
    const names = [/tocar/i, /mutar/i, /legenda/i, /tela cheia/i];
    for (const name of names) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toMatch(/btn-round|rounded-full/i);
      expect(button.className).toContain("h-[44px]");
      expect(button.className).toContain("w-[44px]");
    }
  });

  it("FR-006: a sala não usa superfície de pergaminho", () => {
    const { container } = renderChat();
    expect(container.querySelectorAll('[data-surface="parchment"]').length).toBe(0);
    expect(container.querySelectorAll(".parchment").length).toBe(0);
  });

  it("AC-014: íris é decorativa, não captura ponteiro e some", () => {
    vi.useFakeTimers();
    const { container } = render(<RoomIris />);
    const iris = container.querySelector(".iris");
    expect(iris).toBeTruthy();
    expect(iris?.getAttribute("aria-hidden")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector(".iris")).toBeNull();
    vi.useRealTimers();
  });
});
