import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerShell } from "./PlayerShell";
import type { PlaybackController } from "@/hooks/playerController";

vi.mock("@/components/room/player/PlayerControls", () => ({
  PlayerControls: () => <button>controles</button>,
}));

const controller = { resolution: null } as unknown as PlaybackController;

function bar() {
  return screen.getByRole("button", { name: "controles" }).parentElement as HTMLElement;
}

function renderShell(props: { idle: boolean; controller?: PlaybackController | null; showFullscreenOnly?: boolean }) {
  render(
    <PlayerShell
      controller={props.controller === undefined ? controller : props.controller}
      isFullscreen
      idle={props.idle}
      onToggleFullscreen={() => {}}
      showFullscreenOnly={props.showFullscreenOnly}
    >
      <div />
    </PlayerShell>,
  );
}

describe("PlayerShell", () => {
  it("mostra a barra quando não está ocioso", () => {
    renderShell({ idle: false });

    expect(bar().className).toContain("opacity-100");
    expect(bar().className).not.toContain("pointer-events-none");
  });

  it("esconde a barra e o cursor quando ocioso, sem prender foco de clique", () => {
    renderShell({ idle: true });

    expect(bar().className).toContain("opacity-0");
    expect(bar().className).toContain("pointer-events-none");
    expect(bar().className).not.toContain("focus-within");
    expect(document.querySelector(".cursor-none")).not.toBeNull();
  });

  it("o botão mínimo de tela cheia do iframe genérico nunca some", () => {
    renderShell({ idle: true, controller: null, showFullscreenOnly: true });

    const button = screen.getByRole("button", { name: "Sair da tela cheia" });
    expect(button.closest("[data-idle-hold]")?.className).toContain("opacity-100");
  });
});
