import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, PlayerEvent, RoomEvent, SystemEvent } from "@/liveblocks.config";
import { useChat, type ChatFeedItem } from "./useChat";

// `useChat` só consome `useBroadcastEvent` e `useEventListener` do Liveblocks.
// O primeiro vira um `vi.fn()` (o hook só chama), o segundo é CAPTURADO em vez
// de simulado: assim os testes entregam o evento pelo mesmo caminho de quem
// recebe um broadcast de verdade, em vez de só chamar o `appendMessage`
// devolvido pelo hook. A forma injetada é a de `RoomEventMessage` do
// @liveblocks/core (`{ connectionId, user, event }`); `connectionId`/`user`
// não são lidos pelo hook, mas ficam aqui para o teste não mentir sobre a
// origem do evento.
type BroadcastMessage = {
  connectionId: number;
  user: null;
  event: RoomEvent;
};

const liveblocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  listener: undefined as ((message: BroadcastMessage) => void) | undefined,
}));

vi.mock("@liveblocks/react", () => ({
  useBroadcastEvent: () => liveblocks.broadcast,
  useEventListener: (listener: (message: BroadcastMessage) => void) => {
    liveblocks.listener = listener;
  },
}));

// Valor do teto fixado por FR-015/FR-016. Literal aqui de propósito: é o
// requisito que o teste prova, não um detalhe do fonte.
const LIMIT = 30;

function chatItem(index: number): ChatEvent {
  return {
    type: "CHAT_MESSAGE",
    id: `c${index}`,
    authorId: "u1",
    authorName: "Ana",
    text: `mensagem ${index}`,
    ts: index,
  };
}

function systemItem(index: number): SystemEvent {
  return {
    type: "SYSTEM_MESSAGE",
    id: `s${index}`,
    text: `evento ${index}`,
    ts: index,
  };
}

type Feed = { current: ReturnType<typeof useChat> };

function feedIds(feed: Feed): string[] {
  return feed.current.messages.map((message) => message.id);
}

function renderFeed(): Feed {
  return renderHook(() => useChat({ userId: "u1", userName: "Ana" })).result;
}

// Caminho remoto: o evento chega pelo listener registrado no Liveblocks.
function receive(feed: Feed, items: RoomEvent[]): void {
  act(() => {
    for (const item of items) {
      liveblocks.listener?.({ connectionId: 1, user: null, event: item });
    }
  });
}

// Caminho local: mesma entrada que `useRoomLeaveAnnouncement` usa em produção.
function append(feed: Feed, items: ChatFeedItem[]): void {
  act(() => {
    for (const item of items) feed.current.appendMessage(item);
  });
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

beforeEach(() => {
  liveblocks.broadcast.mockClear();
  liveblocks.listener = undefined;
});

describe("feed do chat — teto de retenção (FR-015)", () => {
  it("AC-014: 40 itens distintos em sequência deixam 30 no feed, começando pelo 11º", () => {
    const feed = renderFeed();
    expect(feedIds(feed)).toEqual([]);

    receive(feed, range(1, 40).map(chatItem));

    const ids = feedIds(feed);
    expect(ids).toHaveLength(LIMIT);
    expect(ids[0]).toBe("c11"); // o 11º anexado
    expect(ids[LIMIT - 1]).toBe("c40"); // o último anexado
    // os 10 primeiros foram descartados, não reordenados
    for (let i = 1; i <= 10; i++) {
      expect(ids).not.toContain(`c${i}`);
    }
  });

  it("entrega pelo broadcast é o que alimenta o feed (o listener está de fato ligado)", () => {
    const feed = renderFeed();

    receive(feed, [chatItem(1)]);
    expect(feedIds(feed)).toEqual(["c1"]);

    const playerEvent: PlayerEvent = {
      type: "PLAY",
      time: 3,
      source: "YOUTUBE",
      actorId: "u1",
      ts: 1,
    };
    receive(feed, [playerEvent]);
    expect(feedIds(feed)).toEqual(["c1"]);
  });
});

describe("mensagens de sistema no mesmo orçamento (FR-017)", () => {
  it("AC-015: 5 mensagens de sistema e 35 de chat intercaladas somam 30 itens no feed", () => {
    const feed = renderFeed();

    // 40 anexos: 1 de sistema a cada 8 (i = 8, 16, 24, 32, 40 → 5 de sistema)
    const interleaved: ChatFeedItem[] = range(1, 40).map((i) =>
      i % 8 === 0 ? systemItem(i) : chatItem(i),
    );
    expect(interleaved.filter((item) => item.type === "SYSTEM_MESSAGE")).toHaveLength(5);

    receive(feed, interleaved);

    const retained = feed.current.messages;
    const system = retained.filter((item) => item.type === "SYSTEM_MESSAGE");
    const chat = retained.filter((item) => item.type === "CHAT_MESSAGE");

    expect(retained).toHaveLength(LIMIT);
    expect(system.length + chat.length).toBe(LIMIT);
    // As duas espécies dividem o mesmo teto: os 5 de sistema consomem
    // orçamento junto com as de chat, não em um balde separado.
    expect(system.map((item) => item.id)).toEqual(["s16", "s24", "s32", "s40"]);
    expect(chat).toHaveLength(LIMIT - system.length);
  });
});

describe("índice de ids usados na deduplicação (FR-016, FR-018)", () => {
  it("AC-016: id descartado pelo limite volta a ser aceito", () => {
    const feed = renderFeed();
    append(feed, range(1, 40).map(chatItem));
    expect(feedIds(feed)[0]).toBe("c11");

    append(feed, [chatItem(1)]); // já descartado

    const ids = feedIds(feed);
    expect(ids).toHaveLength(LIMIT);
    expect(ids).toContain("c1");
    expect(ids).not.toContain("c11"); // o mais antigo saiu para o c1 entrar
  });

  it("AC-017: o índice de ids vistos tem exatamente os 30 itens que o feed retém", () => {
    const feed = renderFeed();
    append(feed, range(1, 40).map(chatItem));

    // O índice é um ref interno, não observável direto. O que é observável é o
    // EFEITO dele: um id presente no índice é descartado como duplicata (o feed
    // não muda), um id ausente é aceito (entra no fim do feed, expulsando o mais
    // antigo). Logo, se cada um dos 10 descartados é aceito, o índice não os
    // contém; e como só ids anexados entram nele, o índice é exatamente o
    // conjunto dos 30 do feed.
    for (let i = 1; i <= 10; i++) {
      const before = feedIds(feed);
      append(feed, [chatItem(i)]);

      const after = feedIds(feed);
      expect(after).toHaveLength(LIMIT);
      expect(after).toEqual([...before.slice(1), `c${i}`]);
    }
  });

  it("AC-018: id que consta no feed não entra de novo (30 itens, sem duplicata)", () => {
    const feed = renderFeed();
    append(feed, range(1, 40).map(chatItem));
    const before = feedIds(feed);
    expect(before).toHaveLength(LIMIT);

    append(feed, [chatItem(15)]); // dentro do feed, e no meio dele

    const after = feedIds(feed);
    expect(after).toEqual(before);
    expect(after.filter((id) => id === "c15")).toHaveLength(1);
  });

  it("reanexar um id que consta no feed não reordena nem reduz o feed", () => {
    const feed = renderFeed();
    receive(feed, range(1, 40).map(chatItem));
    const before = feedIds(feed);

    // Mesmo evento chegando duas vezes pelo broadcast (eco do próprio envio +
    // entrega remota): sem dedupe, a mensagem apareceria duplicada no feed.
    receive(feed, [chatItem(40), chatItem(35)]);

    expect(feedIds(feed)).toEqual(before);
  });
});
