import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { EmojiButton } from "@/components/room/chat/EmojiButton";
import { RECENT_EMOJIS_KEY } from "@/components/room/chat/recentEmojis";

function stubViewport(desktop: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: desktop, media: query }) as MediaQueryList,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  stubViewport(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(onPick = vi.fn()) {
  render(<EmojiButton onPick={onPick} />);
  const trigger = screen.getByRole("button", { name: "Emoji" });
  act(() => {
    fireEvent.click(trigger);
  });
  return { trigger, onPick };
}

function recentsRow() {
  return within(screen.getByRole("group", { name: "Emojis recentes" }));
}

describe("EmojiButton", () => {
  it("abre o painel com foco na busca e liga aria-controls", () => {
    const { trigger } = open();
    const dialog = screen.getByRole("dialog", { name: "Emojis" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Buscar emoji" }));
  });

  it("recentes usam as mesmas colunas da grade e escondem o excesso no desktop", () => {
    window.localStorage.setItem(
      RECENT_EMOJIS_KEY,
      JSON.stringify(["🍕", "🔥", "😀", "👍", "🐶", "🌹", "🎮", "💡"]),
    );
    open();
    const row = screen.getByRole("group", { name: "Emojis recentes" });
    const grid = screen.getByRole("tabpanel").querySelector("[class*=grid-cols-7]");
    expect(row.className).toContain("grid-cols-7");
    expect(row.className).toContain("max-lg:grid-cols-8");
    expect(row.className).toContain("lg:[&>:nth-child(n+8)]:hidden");
    expect(row.className).not.toContain("overflow-x");
    expect(grid?.className).toContain("grid-cols-7");
    expect(recentsRow().getAllByRole("button")).toHaveLength(8);
  });

  it("em tela pequena o foco entra nos recentes", () => {
    stubViewport(false);
    open();
    expect(document.activeElement).toBe(recentsRow().getAllByRole("button")[0]);
  });

  it("sem histórico mostra os emojis de reação nos recentes", () => {
    open();
    expect(recentsRow().getAllByRole("button")).toHaveLength(6);
    expect(recentsRow().getByRole("button", { name: "Inserir coração vermelho" })).toBeTruthy();
  });

  it("escolher chama onPick, atualiza os recentes e mantém o painel aberto", () => {
    const { onPick } = open();
    const grid = screen.getByRole("tabpanel");
    const button = within(grid).getByRole("button", { name: "Inserir sorriso" });
    act(() => {
      fireEvent.click(button);
    });
    expect(onPick).toHaveBeenCalledWith("😀");
    expect(screen.getByRole("dialog", { name: "Emojis" })).toBeTruthy();
    expect(recentsRow().getAllByRole("button")[0].getAttribute("data-emoji")).toBe("😀");
    expect(JSON.parse(window.localStorage.getItem(RECENT_EMOJIS_KEY) ?? "[]")[0]).toBe("😀");
    expect(document.activeElement?.getAttribute("data-emoji")).toBe("😀");
  });

  it("lê recentes salvos", () => {
    window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(["🍕", "🔥"]));
    open();
    const buttons = recentsRow().getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("data-emoji")).toBe("🍕");
  });

  it("busca filtra por nome em todas as categorias", () => {
    open();
    act(() => {
      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar emoji" }), {
        target: { value: "CORAÇÃO" },
      });
    });
    const region = screen.getByRole("region", { name: "Resultados" });
    expect(within(region).getByRole("button", { name: "Inserir coração partido" })).toBeTruthy();
    expect(within(region).queryByRole("button", { name: "Inserir sorriso" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("busca sem resultado mostra estado vazio", () => {
    open();
    act(() => {
      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar emoji" }), {
        target: { value: "zzzzqq" },
      });
    });
    expect(screen.getByText("Nenhum emoji encontrado")).toBeTruthy();
  });

  it("troca de categoria pelas abas", () => {
    open();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Comida" }));
    });
    expect(screen.getByRole("tab", { name: "Comida" }).getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel", { name: "Comida" });
    expect(within(panel).getByRole("button", { name: "Inserir pizza" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Inserir sorriso" })).toBeNull();
  });

  it("setas movem entre abas", () => {
    open();
    const first = screen.getAllByRole("tab")[0];
    act(() => {
      first.focus();
      fireEvent.keyDown(first, { key: "ArrowRight" });
    });
    expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getAllByRole("tab")[1]);
  });

  it("setas, Home e End movem o foco na grade", () => {
    open();
    const panel = screen.getByRole("tabpanel");
    const cells = () => within(panel).getAllByRole("button");
    act(() => {
      cells()[0].focus();
      fireEvent.keyDown(cells()[0], { key: "ArrowRight" });
    });
    expect(document.activeElement).toBe(cells()[1]);
    act(() => {
      fireEvent.keyDown(cells()[1], { key: "ArrowDown" });
    });
    expect(document.activeElement).toBe(cells()[1 + 7]);
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    });
    expect(document.activeElement).toBe(cells()[1]);
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    });
    expect(document.activeElement).toBe(cells()[cells().length - 1]);
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    });
    expect(document.activeElement).toBe(cells()[0]);
  });

  it("setas movem o foco na linha de recentes", () => {
    open();
    const buttons = () => recentsRow().getAllByRole("button");
    act(() => {
      buttons()[0].focus();
      fireEvent.keyDown(buttons()[0], { key: "ArrowRight" });
    });
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it("Escape fecha e devolve o foco ao gatilho", () => {
    const { trigger } = open();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog", { name: "Emojis" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("clique fora fecha", () => {
    open();
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.queryByRole("dialog", { name: "Emojis" })).toBeNull();
  });
});
