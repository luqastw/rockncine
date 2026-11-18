import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoomActions } from "./RoomActions";
import { CHAT_PANEL_ID } from "./chat/ids";

function renderActions(isTheater: boolean, onToggleTheater = vi.fn(), isEconomy = false, onOpenProfile?: () => void) {
  render(
    <RoomActions
      onLoadVideo={() => {}}
      onToggleTheater={onToggleTheater}
      isTheater={isTheater}
      showTheaterToggle
      onToggleEconomy={() => {}}
      isEconomy={isEconomy}
      onOpenProfile={onOpenProfile}
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

describe("ordem e estados da fileira de ações", () => {
  it("ordem: Perfil, Economy, Carregar vídeo", () => {
    renderActions(false, vi.fn(), false, () => {});

    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names.slice(0, 3)).toEqual(["Perfil", "Ativar modo economy", "Carregar vídeo"]);
  });

  it("Perfil é só ícone, com aria-label e title", () => {
    const onOpen = vi.fn();
    renderActions(false, vi.fn(), false, onOpen);

    const profile = screen.getByRole("button", { name: "Perfil" });
    expect(profile.textContent).toBe("");
    expect(profile.getAttribute("title")).toBe("Imagem de perfil");
    fireEvent.click(profile);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sem onOpenProfile (tela cheia) não renderiza Perfil", () => {
    renderActions(false);

    expect(screen.queryByRole("button", { name: "Perfil" })).toBeNull();
  });

  it("Economy inativo: aria-pressed falso, sem estado aceso", () => {
    renderActions(false);

    const economy = screen.getByRole("button", { name: "Ativar modo economy" });
    expect(economy.getAttribute("aria-pressed")).toBe("false");
    expect(economy.getAttribute("data-active")).toBe("false");
  });

  it("Economy ativo: aria-pressed verdadeiro, rótulo de desativar e classe acesa", () => {
    renderActions(false, vi.fn(), true);

    const economy = screen.getByRole("button", { name: "Desativar modo economy" });
    expect(economy.getAttribute("aria-pressed")).toBe("true");
    expect(economy.getAttribute("data-active")).toBe("true");
    expect(economy.className).toContain("text-[var(--leaf-ink)]");
  });
});
