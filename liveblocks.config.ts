import type { VideoSourceKind } from "@/lib/video-source";

export type RoomPresence = {
  userId: string;
  name: string;
};

// Quem está transmitindo a própria tela. Vive no storage — e não no data
// channel do LiveKit nem em memória — porque o app já tem storage por sala, ele
// já é reconciliado e já chega para quem entra depois
// (FR-002, docs/specs/12-transmissao-screen-share/spec.md).
//
// `null` significa "modo player": com transmissão o storage é autoritativo
// sobre o que a sala exibe, e encerrar a transmissão devolve a sala ao vídeo
// que já estava carregado (FR-001/FR-005).
export type BroadcastState = {
  // `userId` do transmissor. A identidade no LiveKit é o mesmo id, o que
  // permite casar a track recebida com o dono declarado aqui.
  broadcasterId: string;
  broadcasterName: string;
  // Quando a transmissão começou. Escrito UMA vez — é o início, e serve para
  // julgar clock adiantado (que nunca muda).
  startedAt: number;
  // Última prova de vida do transmissor, renovada enquanto ele publica. É o
  // que expira: um teto absoluto sobre `startedAt` mataria toda sessão mais longa
  // que a janela, e sessão longa é o caso de uso. Ver `lib/broadcast.ts`.
  heartbeatAt: number;
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
  // Deliberadamente separado de `player`: os dois coexistem no storage. Um
  // cliente que trava o sync do outro (ver risco de `ts` em
  // docs/specs/11-fechamento-auditoria/spec.md, seção 7) não tranca a
  // transmissão, e o inverso também não.
  broadcast: BroadcastState | null;
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

// Início e parada de transmissão NÃO são eventos de broadcast: são escrita em
// `storage.broadcast` (FR-002/FR-003, docs/specs/12-transmissao-screen-share/spec.md).
// A distinção não é estética — o storage é reconciliado e chega para quem entra
// depois (FR-014), enquanto um broadcast é um evento momentâneo que alguém que
// não estava conectado nunca recebe. O estado de transmissão é estado, não
// evento, e é essa a razão de ele morar no storage do Liveblocks e não num data
// channel do Livekit (seção 7, "onde mora o estado").

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
