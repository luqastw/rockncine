import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetChatFeed } from "@/lib/chat-feed";
import { MAX_TEXT_LENGTH } from "@/lib/chat-event";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

// O `<Chat>` real, com o canal do Liveblocks mockado: `useEventListener`
// captura o listener para o teste emitir mensagem pela rede, `useBroadcastEvent`
// captura o envio e `useStatus` é dirigido pelo teste. Nada mais é mockado — o
// log, o agrupamento, as divisórias e o composer são os de produção.

// ── mock do Liveblocks ────────────────────────────────────────────────────────

type Listener = (payload: { event: unknown }) => void;

type Presence = { userId: string; name: string; typing?: boolean };

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  broadcast: vi.fn(),
  status: "connected" as string,
  others: [] as Array<{ presence: Presence | null }>,
  updateMyPresence: vi.fn(),
}));

vi.mock("@liveblocks/react", () => ({
  useBroadcastEvent: () => mocks.broadcast,
  useEventListener: (fn: Listener) => {
    mocks.listeners.push(fn);
  },
  useStatus: () => mocks.status,
  useOthers: () => mocks.others,
  useMyPresence: () => [{ userId: "eu", name: "ana" }, mocks.updateMyPresence],
}));

import { Chat } from "./Chat";

const ME = { userId: "eu", userName: "ana", roomCode: "SALA1234" };
const NOW = Date.now();

let seq = 0;

function emitRemote(partial: Partial<ChatEvent> & { text: string }) {
  seq += 1;
  const event: ChatEvent = {
    type: "CHAT_MESSAGE",
    id: `r${seq}`,
    authorId: "bruno",
    authorName: "bruno",
    ts: NOW,
    ...partial,
  };
  act(() => {
    for (const fn of mocks.listeners) fn({ event });
  });
  return event;
}

function emitSystem(text: string, ts = NOW) {
  seq += 1;
  const event: SystemEvent = { type: "SYSTEM_MESSAGE", id: `s${seq}`, text, ts };
  act(() => {
    for (const fn of mocks.listeners) fn({ event });
  });
  return event;
}

function field() {
  return screen.getByLabelText("mensagem para o chat da sala") as HTMLTextAreaElement;
}

function log() {
  return screen.getByRole("log") as HTMLUListElement;
}

/**
 * jsdom não implementa `scrollTo`/`scrollIntoView` (verificado: `undefined` em
 * `Element.prototype`). O log usa `scrollTo` para poder rolar com comportamento
 * suave; aqui ele vira um espião para o teste observar a chamada.
 */
const scrollToSpy = vi.fn();
const scrollIntoViewSpy = vi.fn();

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.broadcast.mockClear();
  mocks.status = "connected";
  mocks.others = [];
  mocks.updateMyPresence.mockClear();
  seq = 0;
  resetChatFeed();
  scrollToSpy.mockClear();
  scrollIntoViewSpy.mockClear();
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollToSpy,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: scrollIntoViewSpy,
  });
});

afterEach(() => {
  delete (Element.prototype as unknown as Record<string, unknown>).scrollTo;
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

function renderChat() {
  return render(<Chat {...ME} />);
}

/** Abre o popover de emoji (o gatilho fica ao lado do campo). */
function abrirEmojis() {
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "emoji" }));
  });
}

// ── leitura do log ────────────────────────────────────────────────────────────

/**
 * O validador de entrada rejeita `ts` fora de uma banda de ±30s em torno do
 * agora (`lib/chat-event.ts`), então um teste de janela de 5 minutos ou de dia
 * precisa andar o relógio junto com o `ts` do evento. Só `Date` é falsificado:
 * `setTimeout`, `requestAnimationFrame` e o agendamento do React continuam
 * reais, senão o commit do React não acontece dentro do `act`.
 */
function useClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

function at(isoOffsetMs: number, emit: () => void) {
  vi.setSystemTime(NOW + isoOffsetMs);
  emit();
}


describe("Chat — agrupamento por autor", () => {
  it("mostra autor e horário uma vez em falas seguidas do mesmo autor (AC-008)", () => {
    renderChat();
    emitRemote({ text: "oi", ts: NOW });
    emitRemote({ text: "tudo bem?", ts: NOW + 1000 });
    emitRemote({ text: "beleza", ts: NOW + 2000 });

    expect(screen.getAllByText("bruno")).toHaveLength(1);
    // as três falas continuam visíveis
    expect(screen.getByText("oi")).toBeTruthy();
    expect(screen.getByText("tudo bem?")).toBeTruthy();
    expect(screen.getByText("beleza")).toBeTruthy();
  });

  // relógio andando junto: o validador de entrada rejeita `ts` fora de ±30s
  useClock();

  it("repete o autor quando passa da janela de 5 minutos (AC-008)", () => {
    renderChat();
    emitRemote({ text: "oi", ts: NOW });
    at(6 * 60 * 1000, () => emitRemote({ text: "e aí", ts: NOW + 6 * 60 * 1000 }));
    expect(screen.getAllByText("bruno")).toHaveLength(2);
  });

  it("mensagem de sistema interrompe o agrupamento (AC-009)", () => {
    renderChat();
    emitRemote({ text: "oi", ts: NOW });
    emitSystem("fulano saiu", NOW + 500);
    emitRemote({ text: "oi de novo", ts: NOW + 1000 });
    expect(screen.getAllByText("bruno")).toHaveLength(2);
  });

  it("não agrupa falas de autores diferentes (AC-008)", () => {
    renderChat();
    emitRemote({ text: "oi", authorName: "bruno", ts: NOW });
    emitRemote({ text: "oi", authorId: "carla", authorName: "carla", ts: NOW + 100 });
    expect(screen.getAllByText("bruno")).toHaveLength(1);
    expect(screen.getAllByText("carla")).toHaveLength(1);
  });

  it("item agrupado continua expondo autor e horário para o leitor de tela (AC-017)", () => {
    renderChat();
    emitRemote({ text: "oi", ts: NOW });
    emitRemote({ text: "tudo bem?", ts: NOW + 1000 });
    // o texto acessível do segundo item só existe na versão agrupada
    expect(screen.getByText(/^bruno, \d{2}:\d{2}:$/)).toBeTruthy();
  });

  it("marca a mensagem do próprio usuário como própria (AC-013)", () => {
    renderChat();
    emitRemote({ text: "minha", authorId: "eu", authorName: "ana", ts: NOW });
    const own = screen.getByText("minha").closest("li");
    expect(own?.dataset.self).toBe("true");
    expect(own?.className).toContain("justify-end");

    emitRemote({ text: "dele", ts: NOW + 100 });
    const other = screen.getByText("dele").closest("li");
    expect(other?.dataset.self).toBeUndefined();
  });

  it("dá identidade de iniciais e tom ao autor (AC-014)", () => {
    renderChat();
    emitRemote({ text: "oi", authorId: "u-bruno", authorName: "bruno silva", ts: NOW });
    const chip = document.querySelector("[data-initials]");
    expect(chip?.getAttribute("data-initials")).toBe("BS");
    expect(Number(chip?.getAttribute("data-tone"))).toBeGreaterThanOrEqual(0);
  });

  it("insere divisória de dia quando o dia muda (AC-010)", () => {
    renderChat();
    const ontem = NOW - 26 * 60 * 60 * 1000;
    at(ontem - NOW, () => emitRemote({ text: "ontem mesmo", ts: ontem }));
    at(0, () => emitRemote({ text: "hoje", ts: NOW }));
    // "hoje" aparece em dois lugares — a divisória e o texto da própria
    // mensagem do teste — então a asserção é pela divisória.
    expect(screen.getByText("ontem")).toBeTruthy();
    expect(screen.getAllByText("hoje").length).toBeGreaterThanOrEqual(1);
  });
});

// ── não lidas e rolagem ───────────────────────────────────────────────────────

/** Emula o log com conteúdo maior que a caixa e o usuário rolado para cima. */
function scrollUp(list: HTMLElement) {
  Object.defineProperty(list, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(list, "clientHeight", { configurable: true, value: 300 });
  let top = 400;
  Object.defineProperty(list, "scrollTop", { configurable: true, get: () => top });
  act(() => {
    fireEvent.scroll(list);
  });
  return { setTop: (value: number) => (top = value) };
}

describe("Chat — não lidas e posição no log", () => {
  it("marca e conta as mensagens que chegaram fora do rodapé (AC-011)", () => {
    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    scrollUp(log());

    emitRemote({ text: "perdida", ts: NOW + 1000 });
    emitRemote({ text: "perdida 2", ts: NOW + 2000 });

    expect(screen.getByText("novas mensagens")).toBeTruthy(); // divisória
    expect(screen.getByLabelText("2 mensagens não lidas")).toBeTruthy();
  });

  it("limpa a marca quando o usuário volta para o fim (AC-011)", () => {
    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    const { setTop } = scrollUp(log());
    emitRemote({ text: "perdida", ts: NOW + 1000 });
    expect(screen.getByText("novas mensagens")).toBeTruthy();

    // rola de volta até o fim: o handler de scroll marca como lida
    setTop(699);
    act(() => {
      fireEvent.scroll(log());
    });
    expect(screen.queryByText("novas mensagens")).toBeNull();
    expect(screen.queryByLabelText(/não lidas/)).toBeNull();
  });

  it("botão de novas mensagens volta para o fim e limpa a marca (AC-011)", () => {
    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    const { setTop } = scrollUp(log());
    emitRemote({ text: "perdida", ts: NOW + 1000 });
    scrollToSpy.mockClear();

    const button = screen.getByRole("button", { name: /novas mensagens/i });
    act(() => {
      fireEvent.click(button);
    });

    // rolar é a promessa do rótulo: sem isto ele só limpava a marca
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    expect(setTop(699)).toBe(699);
    expect(screen.queryByLabelText(/não lidas/)).toBeNull();
  });

  it("mostra a sombra de conteúdo acima só quando rola (AC-012)", () => {
    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    expect(screen.queryByTestId("chat-scroll-shadow")).toBeNull();

    scrollUp(log());
    expect(screen.getByTestId("chat-scroll-shadow")).toBeTruthy();
  });

  it("rola com comportamento suave quando o movimento é permitido (FR-019)", () => {
    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    scrollToSpy.mockClear();
    emitRemote({ text: "segunda", ts: NOW + 1000 });
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("rola sem animação quando o usuário prefere menos movimento (AC-015)", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    renderChat();
    emitRemote({ text: "primeira", ts: NOW });
    scrollToSpy.mockClear();
    emitRemote({ text: "segunda", ts: NOW + 1000 });

    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    window.matchMedia = original;
  });

  it("rola instantaneamente a mensagem que o próprio usuário mandou (FR-019)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "minha" } });
      fireEvent.submit(field().closest("form")!);
    });
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
});

// ── envio ─────────────────────────────────────────────────────────────────────

describe("Chat — envio e composer", () => {
  it("Enter envia uma vez e limpa o campo (AC-018)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "olá" } });
    });
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter" });
    });
    expect(mocks.broadcast).toHaveBeenCalledTimes(1);
    expect(mocks.broadcast.mock.calls[0][0]).toMatchObject({ text: "olá" });
    expect(field().value).toBe("");
  });

  it("Shift+Enter quebra linha e não envia (AC-019)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "linha 1" } });
    });
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    });
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(field().value).toBe("linha 1");
  });

  it("Enter durante composição de IME não envia (FR-024)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "Brasi" } });
    });
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    });
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it("não envia campo em branco (AC-021)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "    " } });
    });
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter" });
    });
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it("mostra o contador perto do limite e avisa do corte (AC-020)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "a".repeat(450) } });
    });
    expect(screen.getByText(`450/${MAX_TEXT_LENGTH}`)).toBeTruthy();
    expect(screen.queryByText(/vai ser cortada/)).toBeNull();

    act(() => {
      fireEvent.change(field(), { target: { value: "a".repeat(MAX_TEXT_LENGTH + 1) } });
    });
    expect(screen.getByText(/vai ser cortada/)).toBeTruthy();
  });

  it("não mostra o contador longe do limite (AC-020)", () => {
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "oi" } });
    });
    expect(screen.queryByText(`2/${MAX_TEXT_LENGTH}`)).toBeNull();
  });

  // Os emojis vivem num popover (T-017): abrir o gatilho é parte do caminho.
  it("emoji entra na posição do cursor (AC-022)", () => {
    renderChat();
    const input = field();
    act(() => {
      fireEvent.change(input, { target: { value: "abc" } });
    });
    input.setSelectionRange(1, 1);
    abrirEmojis();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "inserir ❤️ na mensagem" }));
    });
    expect(input.value).toBe("a❤️bc");
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it("campo só com o emoji manda na hora (AC-023)", () => {
    renderChat();
    const input = field();
    input.setSelectionRange(0, 0);
    abrirEmojis();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "inserir ❤️ na mensagem" }));
    });
    expect(mocks.broadcast).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
  });

  it("popover abre com foco no primeiro emoji e Escape devolve o foco (T-017)", () => {
    renderChat();
    const trigger = screen.getByRole("button", { name: "emoji" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "emojis" })).toBeNull();

    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const first = screen.getByRole("button", { name: "inserir ❤️ na mensagem" });
    expect(document.activeElement).toBe(first);

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("group", { name: "emojis" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("leva o composer para a área visível ao focar (AC-024)", () => {
    renderChat();
    act(() => {
      fireEvent.focus(field());
    });
    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });

  it("avisa que a mensagem está na fila fora de conexão, e aceita texto (AC-025)", () => {
    mocks.status = "reconnecting";
    renderChat();
    expect(screen.getByRole("status").textContent).toContain("fila");
    act(() => {
      fireEvent.change(field(), { target: { value: "durante a queda" } });
    });
    expect(field().value).toBe("durante a queda");
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter" });
    });
    // o campo aceitou e a mensagem entrou no log local — a fila de transmission é
    // do hook (FR-005), então aqui não se transmite nada
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(screen.getByText("durante a queda")).toBeTruthy();
  });

  it("não mostra aviso de fila quando conectado", () => {
    renderChat();
    expect(screen.queryByText(/fila/)).toBeNull();
  });
});

// ── custo por tecla ───────────────────────────────────────────────────────────

describe("Chat — custo de formatação", () => {
  it("não formata horário dentro do render (AC-002)", () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
    renderChat();
    for (let i = 0; i < 30; i++) emitRemote({ text: `msg ${i}`, ts: NOW + i });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("digitar não reformata o que já está na tela (AC-003)", () => {
    renderChat();
    for (let i = 0; i < 30; i++) emitRemote({ text: `msg ${i}`, ts: NOW + i });

    const nodesBefore = Array.from(log().children);
    const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
    act(() => {
      fireEvent.change(field(), { target: { value: "o" } });
    });
    expect(spy).not.toHaveBeenCalled();
    // os nós do log são os mesmos: nada abaixo do composer foi reconstruído
    expect(Array.from(log().children).slice(0, nodesBefore.length)).toEqual(nodesBefore);
    spy.mockRestore();
  });
});
describe("Chat — indicador de digitação", () => {
  it("liga o indicador na primeira tecla e desliga depois do ocioso (AC-026)", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    renderChat();
    const input = field();

    act(() => {
      fireEvent.change(input, { target: { value: "o" } });
      fireEvent.change(input, { target: { value: "oi" } });
    });
    // uma escrita só: presence por tecla seria tráfego por tecla
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).toHaveBeenCalledWith({ typing: true });

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(mocks.updateMyPresence).toHaveBeenLastCalledWith({ typing: false });
    vi.useRealTimers();
  });

  it("enviar desliga o indicador na hora", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    renderChat();
    act(() => {
      fireEvent.change(field(), { target: { value: "pronto" } });
    });
    act(() => {
      fireEvent.keyDown(field(), { key: "Enter" });
    });
    expect(mocks.updateMyPresence).toHaveBeenLastCalledWith({ typing: false });
    vi.useRealTimers();
  });

  it("mostra quem está digitando uma vez por pessoa (AC-027)", () => {
    mocks.others = [
      { presence: { userId: "b", name: "bruno", typing: true } },
      // mesma pessoa, segunda aba
      { presence: { userId: "b", name: "bruno", typing: true } },
      { presence: { userId: "c", name: "carla", typing: true } },
      { presence: { userId: "d", name: "dani" } },
      { presence: { userId: "eu", name: "ana", typing: true } },
    ];
    renderChat();
    expect(screen.getByText(/bruno, carla estão digitando/)).toBeTruthy();
    expect(screen.queryByText(/dani está digitando/)).toBeNull();
    expect(screen.queryByText(/ana está digitando/)).toBeNull();
  });

  // O log é região `aria-live`: um nó que aparece e some a cada tecla seria
  // anunciado ("bruno está digitando" × N). `aria-live="off"` no descendente é
  // o que o tira da árvore de anúncios.
  it("tira o indicador de digitação da árvore de anúncios do log", () => {
    mocks.others = [{ presence: { userId: "b", name: "bruno", typing: true } }];
    renderChat();
    const item = screen.getByText(/bruno está digitando/).closest("li");
    expect(item?.getAttribute("aria-live")).toBe("off");
  });

  it("não mostra nada quando ninguém está digitando", () => {
    renderChat();
    expect(screen.queryByText(/digitando/)).toBeNull();
  });
});
