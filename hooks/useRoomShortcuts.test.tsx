import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useRoomShortcuts } from "@/hooks/useRoomShortcuts";
import type { PlaybackController } from "@/hooks/playerController";

function makeController(): PlaybackController {
  return {
    isReady: true,
    currentTime: 20,
    togglePlay: vi.fn(),
    seek: vi.fn(),
    toggleMute: vi.fn(),
  } as unknown as PlaybackController;
}

function Harness(props: Partial<Parameters<typeof useRoomShortcuts>[0]> & { controller: PlaybackController | null }) {
  const { controller, ...rest } = props;
  useRoomShortcuts({
    activeController: controller,
    loadModalOpen: false,
    cssFullscreen: false,
    isBroadcasting: false,
    toggleFullscreen: vi.fn(),
    exitCssFullscreen: vi.fn(),
    ...rest,
  });
  return <input data-testid="campo" />;
}

describe("useRoomShortcuts", () => {
  it("espaço e k alternam play; setas buscam; m muta", () => {
    const controller = makeController();
    render(<Harness controller={controller} />);
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "k" });
    expect(controller.togglePlay).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(controller.seek).toHaveBeenLastCalledWith(15);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(controller.seek).toHaveBeenLastCalledWith(25);
    fireEvent.keyDown(window, { key: "m" });
    expect(controller.toggleMute).toHaveBeenCalledTimes(1);
  });

  it("f alterna tela cheia e Esc sai do fullscreen css", () => {
    const toggleFullscreen = vi.fn();
    const exitCssFullscreen = vi.fn();
    render(<Harness controller={null} cssFullscreen toggleFullscreen={toggleFullscreen} exitCssFullscreen={exitCssFullscreen} />);
    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleFullscreen).toHaveBeenCalledTimes(1);
    expect(exitCssFullscreen).toHaveBeenCalledTimes(1);
  });

  it("ignora em input, com modal, com modificador e em transmissão", () => {
    const controller = makeController();
    const { getByTestId, rerender } = render(<Harness controller={controller} />);
    fireEvent.keyDown(getByTestId("campo"), { key: " " });
    fireEvent.keyDown(window, { key: " ", ctrlKey: true });
    expect(controller.togglePlay).not.toHaveBeenCalled();

    rerender(<Harness controller={controller} loadModalOpen />);
    fireEvent.keyDown(window, { key: " " });
    expect(controller.togglePlay).not.toHaveBeenCalled();

    rerender(<Harness controller={controller} isBroadcasting />);
    fireEvent.keyDown(window, { key: " " });
    expect(controller.togglePlay).not.toHaveBeenCalled();
  });
});
