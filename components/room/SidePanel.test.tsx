import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendChatItem, resetChatFeed } from "@/lib/chat-feed";

type Presence = { userId: string; name: string };

const mocks = vi.hoisted(() => ({
  others: [] as Array<{ presence: Presence | null }>,
}));

vi.mock("@liveblocks/react", () => ({
  useBroadcastEvent: () => vi.fn(),
  useEventListener: () => undefined,
  useStatus: () => "connected",
  useOthers: () => mocks.others,
  useMyPresence: () => [{ userId: "eu", name: "ana" }, vi.fn()],
}));

import { SidePanel } from "./SidePanel";

const NOW = Date.now();

function message(id: string, authorId: string, text: string) {
  act(() =>
    appendChatItem({ type: "CHAT_MESSAGE", id, authorId, authorName: authorId, text, ts: NOW }),
  );
}

function renderPanel() {
  return render(<SidePanel userId="eu" userName="ana" roomCode="SALA1234" />);
}

describe("SidePanel", () => {
  beforeEach(() => {
    mocks.others = [];
    resetChatFeed();
  });

  it("seta direita seleciona pessoas e mostra o painel (AC-014)", () => {
    renderPanel();
    const chatTab = screen.getByRole("tab", { name: "chat" });
    chatTab.focus();
    fireEvent.keyDown(chatTab, { key: "ArrowRight" });
    const peopleTab = screen.getByRole("tab", { name: "pessoas (1)" });
    expect(peopleTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(peopleTab);
    expect(peopleTab.getAttribute("tabindex")).toBe("0");
    expect(chatTab.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tabpanel", { name: "pessoas (1)" }).hidden).toBe(false);
    expect(screen.getByText("(você)")).toBeTruthy();
  });

  it("preserva rascunho e mensagens ao ir e voltar (AC-015)", () => {
    renderPanel();
    message("a", "bruno", "primeira");
    message("b", "bruno", "segunda");
    const campo = screen.getByLabelText("mensagem para o chat da sala") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "oi" } });
    fireEvent.click(screen.getByRole("tab", { name: "pessoas (1)" }));
    expect(campo.isConnected).toBe(true);
    expect(campo.closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "chat" }));
    const depois = screen.getByLabelText("mensagem para o chat da sala") as HTMLTextAreaElement;
    expect(depois).toBe(campo);
    expect(depois.value).toBe("oi");
    expect(screen.getByText("primeira")).toBeTruthy();
    expect(screen.getByText("segunda")).toBeTruthy();
  });

  it("conta mensagem de outro enquanto pessoas está ativa e zera ao voltar (AC-016)", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "pessoas (1)" }));
    message("m1", "eu", "minha");
    message("m2", "bruno", "dele");
    const chatTab = screen.getByRole("tab", { name: "chat, 1 não lida" });
    expect(chatTab.textContent).toContain("1");
    fireEvent.click(chatTab);
    expect(screen.getByRole("tab", { name: "chat" })).toBeTruthy();
  });

  it("mostra o total de presentes na aba (AC-017)", () => {
    mocks.others = [
      { presence: { userId: "bruno", name: "bruno" } },
      { presence: { userId: "carla", name: "carla" } },
    ];
    renderPanel();
    expect(screen.getByRole("tab", { name: "pessoas (3)" })).toBeTruthy();
  });
});
