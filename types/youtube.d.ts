export {};

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    enum PlayerState {
      UNSTARTED = -1,
      ENDED = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5,
    }

    interface OnStateChangeEvent {
      data: PlayerState;
      target: Player;
    }

    interface PlayerEvents {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
    }

    interface PlayerOptions {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, unknown>;
      events?: PlayerEvents;
    }

    class Player {
      constructor(elementId: string | HTMLElement, options: PlayerOptions);
      playVideo(): void;
      pauseVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getPlayerState(): PlayerState;
      loadVideoById(videoId: string): void;
      destroy(): void;
    }
  }
}
