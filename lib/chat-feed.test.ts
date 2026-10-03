import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_MESSAGES,
  appendChatItem,
  getChatFeed,
  resetChatFeed,
  subscribeChatFeed,
} from "./chat-feed";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

const T0 = 1_700_000_000_000;

function chat(id: string, ts: number, authorId = "a"): ChatEvent {
  return {
    type: "CHAT_MESSAGE",
    id,
    authorId,
    authorName: "ana",
    text: `msg ${id}`,
    ts,
  };
}

function system(id: string, ts: number): SystemEvent {
  return { type: "SYSTEM_MESSAGE", id, text: "ana saiu", ts };
}

const ROOM = "SALA1234";

let notified = 0;
const subscriptions: Array<() => void> = [];

beforeEach(() => {
  for (const off of subscriptions) off();
  subscriptions.length = 0;
  resetChatFeed();
  notified = 0;
  subscriptions.push(
    subscribeChatFeed(() => {
      notified += 1;
    }),
  );
});

describe("store do feed de chat", () => {
  // AC-004
  it("mantém a ordem do relógio quando o item chega atrasado (FR-004)", () => {
    appendChatItem(chat("a", T0));
    appendChatItem(chat("c", T0 + 100));
    appendChatItem(chat("b", T0 + 50));
    expect(getChatFeed(ROOM).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  // AC-004 (par): empate de `ts` preserva a ordem de chegada.
  it("mantém a ordem de chegada entre itens de mesmo ts", () => {
    appendChatItem(chat("a", T0));
    appendChatItem(chat("b", T0));
    appendChatItem(chat("c", T0));
    expect(getChatFeed(ROOM).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("deduplica por id e não notifica no descarte (FR-003)", () => {
    appendChatItem(chat("a", T0));
    notified = 0;
    appendChatItem(chat("a", T0 + 1));
    expect(getChatFeed(ROOM)).toHaveLength(1);
    expect(notified).toBe(0);
  });

  // AC-007
  it("corta em 30 e reconstrói o índice de ids a partir do que sobrou (FR-003)", () => {
    for (let i = 0; i < 40; i++) appendChatItem(chat(`m${i}`, T0 + i));
    const feed = getChatFeed(ROOM);
    expect(feed).toHaveLength(MAX_MESSAGES);
    expect(feed[0].id).toBe("m10");
    expect(feed[MAX_MESSAGES - 1].id).toBe("m39");

    // o id descartado pode voltar a ser aceito (spec 10, FR-018)
    appendChatItem(chat("m0", T0 + 1000));
    expect(getChatFeed(ROOM)).toHaveLength(MAX_MESSAGES);
    expect(getChatFeed(ROOM)[MAX_MESSAGES - 1].id).toBe("m0");
  });

  it("conta mensagem de sistema no mesmo teto (spec 10, FR-017)", () => {
    for (let i = 0; i < 5; i++) appendChatItem(system(`s${i}`, T0 + i));
    for (let i = 0; i < 35; i++) appendChatItem(chat(`c${i}`, T0 + 10 + i));
    expect(getChatFeed(ROOM)).toHaveLength(MAX_MESSAGES);
  });

  // AC-006
  it("reset limpa o feed e avisa quem estava assinando (FR-007)", () => {
    appendChatItem(chat("a", T0));
    notified = 0;
    resetChatFeed();
    expect(getChatFeed(ROOM)).toEqual([]);
    expect(notified).toBe(1);
  });

  it("reset em feed vazio não notifica ninguém", () => {
    notified = 0;
    resetChatFeed();
    expect(notified).toBe(0);
  });

  // AC-006: a store é um módulo e sobrevive à sala. Entrar em outra sala zera no
  // primeiro snapshot, não em um efeito depois do quadro — o store tem UMA sala
  // por vez, não duas: o histórico é efêmero (spec 01, seção 2) e só existe o
  // da sala em que se está.
  it("zera o feed quando a sala muda (FR-007)", () => {
    appendChatItem(chat("a", T0));
    // a primeira leitura adota a sala sem descartar o que foi anexado antes dela
    expect(getChatFeed(ROOM)).toHaveLength(1);

    // entrar na outra sala zera — nenhum quadro com o histórico da anterior
    expect(getChatFeed("OUTRA")).toEqual([]);

    appendChatItem(chat("b", T0 + 1));
    expect(getChatFeed("OUTRA")).toHaveLength(1);

    // e voltar para a primeira também começa do zero, pelo mesmo motivo
    expect(getChatFeed(ROOM)).toEqual([]);
  });

  it("devolve a mesma referência enquanto o feed não muda (FR-001)", () => {
    const before = getChatFeed(ROOM);
    expect(getChatFeed(ROOM)).toBe(before);
    appendChatItem(chat("a", T0));
    expect(getChatFeed(ROOM)).not.toBe(before);
  });

  it("para de notificar quem cancelou a assinatura", () => {
    let own = 0;
    const unsubscribe = subscribeChatFeed(() => {
      own += 1;
    });
    appendChatItem(chat("a", T0));
    expect(own).toBe(1);
    unsubscribe();
    appendChatItem(chat("b", T0 + 1));
    expect(own).toBe(1);
  });
});