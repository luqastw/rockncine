import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoomActions } from "./RoomActions";
import { CHAT_PANEL_ID } from "./chat/ids";

function renderActions(isTheater: boolean, onToggleTheater = vi.fn()) {
  render(
    <RoomActions
      onLoadVideo={() => {}}
      onToggleTheater={onToggleTheater}
      isTheater={isTheater}
      showTheaterToggle
      onToggleEconomy={() => {}}
      isEconomy={false}
    />,
  );
  return onToggleTheater;
}

describe("alternador do chat em tela cheia", () => {
  it("fechado: rótulo Abrir chat, aria-expanded falso e aria-controls no painel", () => {
    renderActions(false);

    const toggle = screen.getByRole("button", { name: "Abrir chat" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(CHAT_PANEL_ID);
  });

  it("aberto: rótulo Fechar chat, aria-expanded verdadeiro, e clicar alterna", () => {
    const onToggle = renderActions(true);

    const toggle = screen.getByRole("button", { name: "Fechar chat" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
