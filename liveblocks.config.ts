import type { VideoSourceKind } from "@/lib/video-source";

export type RoomPresence = {
  userId: string;
  name: string;
};

export type RoomStorage = {
  video: {
    source: VideoSourceKind | null;
    embedUrl: string | null;
    sourceUrl: string | null;
    // muda a cada "carregar", mesmo pra URL idêntica — dispara o efeito de
    // (re)criação do player mesmo quando source/embedUrl não mudam de valor.
    loadedAt: number | null;
  };
  player: {
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
    lastActorId: string;
  };
};

export type PlayerEvent =
  | {
      type: "LOAD_VIDEO";
      source: VideoSourceKind;
      embedUrl: string;
      sourceUrl: string;
      actorId: string;
      ts: number;
    }
  // `source` em todo evento de player: sem ele, um PLAY emitido enquanto a
  // sala estava no Vimeo era aplicado no player do YouTube recém-carregado
  // (conteúdo diferente), buscando no lugar errado. `ts` é o relógio de QUEM
  // emitiu — alimenta o last-write-wins e a estimativa de desvio de relógio
  // (ver lib/playback/).
  | { type: "PLAY"; time: number; source: VideoSourceKind; actorId: string; ts: number }
  | { type: "PAUSE"; time: number; source: VideoSourceKind; actorId: string; ts: number }
  | { type: "SEEK"; time: number; source: VideoSourceKind; actorId: string; ts: number };

export type ChatEvent = {
  type: "CHAT_MESSAGE";
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  ts: number;
};

export type SystemEvent = {
  type: "SYSTEM_MESSAGE";
  id: string;
  text: string;
  ts: number;
};

// atalho de emoji no campo de mensagem do chat — não é um evento de
// broadcast próprio, só insere no draft (ver components/room/Chat.tsx).
export const REACTION_EMOJIS = ["❤️", "💔", "🔥", "😢", "🐔", "🍲"] as const;

export type RoomEvent = PlayerEvent | ChatEvent | SystemEvent;

declare global {
  interface Liveblocks {
    Presence: RoomPresence;
    Storage: RoomStorage;
    UserMeta: {
      id: string;
      info: { name: string };
    };
    RoomEvent: RoomEvent;
  }
}
