import type { VideoSourceKind } from "@/lib/video-source";

export type RoomPresence = {
  userId: string;
  name: string;
  isMuted: boolean;
};

export type RoomStorage = {
  video: {
    source: VideoSourceKind | null;
    embedUrl: string | null;
    sourceUrl: string | null;
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
  | { type: "PLAY"; time: number; actorId: string; ts: number }
  | { type: "PAUSE"; time: number; actorId: string; ts: number }
  | { type: "SEEK"; time: number; actorId: string; ts: number };

export type ChatEvent = {
  type: "CHAT_MESSAGE";
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  ts: number;
};

export type RoomEvent = PlayerEvent | ChatEvent;

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
