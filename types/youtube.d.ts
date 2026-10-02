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

    // 2: parâmetro inválido, 5: erro de HTML5, 100: não encontrado/privado,
    // 101/150: dono desabilitou embed nesse player (inclui vídeos restritos)
    type PlayerError = 2 | 5 | 100 | 101 | 150;

    interface OnErrorEvent {
      data: PlayerError;
      target: Player;
    }

    interface PlayerEvents {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
      onApiChange?: (event: { target: Player }) => void;
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
      getDuration(): number;
      getPlayerState(): PlayerState;
      loadVideoById(videoId: string): void;
      setVolume(volume: number): void;
      getVolume(): number;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      // `loadModule`/`unloadModule` controlam a disponibilidade de um módulo
      // com API exposta ("captions", "annotations"). Lado a lado porque a
      // preferência de legenda liga pelo primeiro e desliga pelo segundo.
      loadModule(module: string): void;
      unloadModule(module: string): void;
      setOption(module: string, option: string, value: unknown): void;
      destroy(): void;
    }
  }
}
