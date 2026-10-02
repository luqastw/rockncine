import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "./useChat";
import { MAX_TEXT_LENGTH, parseChatEvent } from "@/lib/chat-event";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

// ── o coletor de eventos ──────────────────────────────────────────────────────
// `useChat` assina o broadcast do Liveblocks. Para exercitar o caminho de
// ENTRADA (o que o parser precisa barrar) sem subir um room provider, o
// listener é capturado de um mock do pacote e disparado à mão.

type Listener = (payload: { event: unknown }) => void;

const listeners: Listener[] = [];
const broadcastMock = vi.fn();

vi.mock("@liveblocks/react", () => ({
  useBroadcastEvent: () => broadcastMock,
  useEventListener: (fn: Listener) => {
    listeners.push(fn);
  },
}));

// `act` em volta: os dois caminhos tocam `setMessages`, e sem ele o React avisa
// de atualização fora de act e a asserção roda antes do commit.
function emit(event: unknown) {
  act(() => {
    for (const fn of listeners) fn({ event });
  });
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useChat>) => void }) {
  const api = useChat({ userId: "me", userName: "eu" });
  onReady(api);
  return (
    <ul>
      {api.messages.map((m) => (
        <li key={m.id}>{m.type === "SYSTEM_MESSAGE" ? m.text : `${m.authorName}: ${m.text}`}</li>
      ))}
    </ul>
  );
}

const NOW = Date.now();
const base = { id: "m1", authorId: "a", authorName: "ana", ts: NOW };

describe("parseChatEvent", () => {
  it("aceita mensagem de chat bem formada", () => {
    const event: ChatEvent = { type: "CHAT_MESSAGE", ...base, text: "oi" };
    expect(parseChatEvent(event, NOW)).toEqual(event);
  });

  it("aceita mensagem de sistema bem formada", () => {
    const event: SystemEvent = { type: "SYSTEM_MESSAGE", id: "s1", text: "ana saiu", ts: NOW };
    expect(parseChatEvent(event, NOW)).toEqual(event);
  });

  it("rejeita payload que não é objeto", () => {
    for (const value of [null, undefined, "oi", 42, true, []]) {
      expect(parseChatEvent(value, NOW)).toBeNull();
    }
  });

  it("rejeita tipo desconhecido", () => {
    expect(parseChatEvent({ ...base, type: "PLAY", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ type: "LOAD_VIDEO", id: "x", text: "y", ts: NOW }, NOW)).toBeNull();
  });

  // O caso que derrubava a sala inteira: `text` como objeto vira child do
  // React e estoura "Objects are not valid as a React child".
  it("rejeita text que não é string", () => {
    for (const text of [{}, [], { toString: () => "p" }, 42, true, null]) {
      expect(parseChatEvent({ ...base, type: "CHAT_MESSAGE", text }, NOW)).toBeNull();
    }
  });

  it("rejeita text acima do teto", () => {
    expect(parseChatEvent({ ...base, type: "CHAT_MESSAGE", text: "a".repeat(MAX_TEXT_LENGTH) }, NOW)).not.toBeNull();
    expect(parseChatEvent({ ...base, type: "CHAT_MESSAGE", text: "a".repeat(MAX_TEXT_LENGTH + 1) }, NOW)).toBeNull();
  });

  it("rejeita id ausente, vazio ou longo demais", () => {
    expect(parseChatEvent({ ...base, id: "", type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, id: 42, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, id: "x".repeat(65), type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
  });

  it("rejeita authorId ausente ou vazio em mensagem de chat", () => {
    expect(parseChatEvent({ ...base, authorId: "", type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ id: "m", authorName: "a", ts: NOW, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
  });

  // `authorId` decide o "(você)" por igualdade estrita e `authorName` é
  // truncado no card: um objeto no lugar estraga os dois.
  it("rejeita authorId/authorName que não são strings", () => {
    expect(parseChatEvent({ ...base, authorId: {}, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, authorName: {}, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
  });

  it("aceita authorName vazio (usuário sem nome cai no email)", () => {
    const event = parseChatEvent({ ...base, authorName: "", type: "CHAT_MESSAGE", text: "oi" }, NOW);
    expect(event?.type).toBe("CHAT_MESSAGE");
    expect(event && "authorName" in event ? event.authorName : null).toBe("");
  });

  it("rejeita authorName acima do teto", () => {
    expect(parseChatEvent({ ...base, authorName: "n".repeat(65), type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
  });

  it("rejeita ts não finito ou fora da banda de plausibilidade", () => {
    expect(parseChatEvent({ ...base, ts: Number.NaN, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, ts: "x", type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, ts: NOW + 60_000, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, ts: NOW - 60_000, type: "CHAT_MESSAGE", text: "oi" }, NOW)).toBeNull();
    expect(parseChatEvent({ ...base, ts: NOW - 5_000, type: "CHAT_MESSAGE", text: "oi" }, NOW)).not.toBeNull();
  });
});

describe("useChat — entrada pela rede", () => {
  beforeEach(() => {
    listeners.length = 0;
    broadcastMock.mockClear();
    render(<Probe onReady={() => {}} />);
  });

  it("entrega ao feed uma mensagem remota bem formada", () => {
    emit({ type: "CHAT_MESSAGE", ...base, text: "oi pessoal" });
    expect(screen.getByText("ana: oi pessoal")).toBeTruthy();
  });

  // A regressão que motivou o validador: sem ele, este payload estourava o
  // React no render do `Chat` e a tela inteira da sala caía.
  it("ignora payload com text malformado em vez de derrubar o render", () => {
    expect(() => emit({ type: "CHAT_MESSAGE", ...base, text: { toString: () => "p" } })).not.toThrow();
    expect(screen.queryByText(/ana:/)).toBeNull();
  });

  it("ignora evento de player que arrives pelo mesmo canal", () => {
    emit({ type: "PLAY", time: 10, source: "YOUTUBE", actorId: "a", ts: Date.now() });
    expect(screen.queryByText(/ana:/)).toBeNull();
  });

  it("deduplica por id, como antes", () => {
    const event = { type: "CHAT_MESSAGE", ...base, text: "oi" };
    emit(event);
    emit(event);
    expect(screen.getAllByText("ana: oi")).toHaveLength(1);
  });
});

describe("useChat — envio local", () => {
  let api: ReturnType<typeof useChat>;

  beforeEach(() => {
    listeners.length = 0;
    broadcastMock.mockClear();
    render(<Probe onReady={(a) => (api = a)} />);
  });

  it("aparece otimista e é transmitido", () => {
    act(() => api.sendMessage("  olá  "));
    expect(screen.getByText("eu: olá")).toBeTruthy();
    expect(broadcastMock).toHaveBeenCalledTimes(1);
    expect(broadcastMock.mock.calls[0][0]).toMatchObject({ type: "CHAT_MESSAGE", text: "olá" });
  });

  it("ignora mensagem em branco", () => {
    api.sendMessage("   ");
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  // A UI não pode produzir um payload que o validador dos outros descartaria:
  // a mensagem apareceria para quem envia e sumiria para quem recebe.
  it("corta no mesmo teto que o validador de entrada aplica", () => {
    act(() => api.sendMessage("a".repeat(MAX_TEXT_LENGTH + 500)));
    const enviado = broadcastMock.mock.calls[0][0] as ChatEvent;
    expect(enviado.text).toHaveLength(MAX_TEXT_LENGTH);
    expect(parseChatEvent(enviado)).not.toBeNull();
  });
});
