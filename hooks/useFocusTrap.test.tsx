import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// `LoadVideoModal` chama `useLoadVideo`, que usa `useBroadcastEvent`/`useMutation`
// do Liveblocks e exige um `RoomProvider` na árvore. O mock fica no topo do
// arquivo porque `vi.mock` é hoisted — mas ele afeta o `LoadVideoModal` só,
// e o `useFocusTrap` é testado direto, sem passar por ele.
vi.mock("@/hooks/useLoadVideo", () => ({ useLoadVideo: () => async () => {} }));

// O `LoadVideoModal` é importado dinamicamente DEPOIS do mock para não puxar o
// módulo real do Liveblocks no topo do arquivo.
let LoadVideoModal: typeof import("@/components/room/player/LoadVideoModal").LoadVideoModal;

beforeEach(async () => {
  ({ LoadVideoModal } = await import("@/components/room/player/LoadVideoModal"));
});

function pressTab(init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

describe("useFocusTrap", () => {
  function Harness({ open }: { open: boolean }) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    useFocusTrap(panelRef, open);
    return (
      <div>
        <button type="button">fora</button>
        <div ref={panelRef} role="dialog" aria-label="painel">
          <button type="button">primeiro</button>
          <button type="button">meio</button>
          <button type="button">ultimo</button>
        </div>
      </div>
    );
  }

  const btn = (name: string) => screen.getByRole("button", { name });

  it("cicia do último para o primeiro com Tab", () => {
    render(<Harness open />);
    btn("ultimo").focus();
    expect(document.activeElement).toBe(btn("ultimo"));

    const e = pressTab();

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btn("primeiro"));
  });

  it("cicia do primeiro para o último com Shift+Tab", () => {
    render(<Harness open />);
    btn("primeiro").focus();

    const e = pressTab({ shiftKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btn("ultimo"));
  });

  it("não sequestra Tab no meio do painel", () => {
    render(<Harness open />);
    btn("meio").focus();

    const e = pressTab();

    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(btn("meio"));
  });

  it("ignora outras teclas", () => {
    render(<Harness open />);
    btn("ultimo").focus();
    const antes = document.activeElement;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));

    expect(document.activeElement).toBe(antes);
  });

  it("não escuta quando inativo", () => {
    render(<Harness open={false} />);
    btn("ultimo").focus();

    const e = pressTab();

    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(btn("ultimo"));
  });

  it("não faz nada quando o painel não tem focáveis", () => {
    function Empty() {
      const panelRef = useRef<HTMLDivElement | null>(null);
      useFocusTrap(panelRef, true);
      return <div ref={panelRef} role="dialog" aria-label="vazio" />;
    }
    render(<Empty />);

    const e = pressTab();

    expect(e.defaultPrevented).toBe(false);
  });

  it("para de escutar quando desativa", () => {
    const { rerender } = render(<Harness open />);
    btn("ultimo").focus();
    rerender(<Harness open={false} />);

    const e = pressTab();

    expect(e.defaultPrevented).toBe(false);
  });
});

// Os dois diálogos shareiam a mesma lista de focáveis copiada, e o
// `ConfirmDialog` foi extraído justamente para não duplicar — a duplicação
// ficou. Estes testes existem para que uma volta a implementação local não
// passe despercebida: o hook é a única implementação, e os dois diálogos
// precisam falar com ele.
describe("diálogos usam o trap compartilhado", () => {
  function focarUltimoDoDialogo(dialog: HTMLElement) {
    const botoes = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
    const ultimo = botoes[botoes.length - 1];
    ultimo.focus();
    return ultimo;
  }

  it("ConfirmDialog prende Tab no painel", () => {
    render(
      <ConfirmDialog
        open
        title="excluir sala"
        description="a sala será apagada"
        confirmLabel="excluir sala"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    focarUltimoDoDialogo(dialog);

    const e = pressTab();

    expect(e.defaultPrevented).toBe(true);
    const primeiro = Array.from(dialog.querySelectorAll<HTMLElement>("button"))[0];
    expect(document.activeElement).toBe(primeiro);
  });

  it("LoadVideoModal prende Tab no painel", () => {
    render(<LoadVideoModal roomCode="ABCD2345" userId="u1" open onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    focarUltimoDoDialogo(dialog);

    const e = pressTab();

    expect(e.defaultPrevented).toBe(true);
    const primeiro = Array.from(dialog.querySelectorAll<HTMLElement>("button"))[0];
    expect(document.activeElement).toBe(primeiro);
  });

  it("ConfirmDialog fecha com Escape", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        confirmLabel="c"
        onConfirm={() => {}}
        onClose={onClose}
      />,
    );
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("LoadVideoModal fecha com Escape", () => {
    const onClose = vi.fn();
    render(<LoadVideoModal roomCode="ABCD2345" userId="u1" open onClose={onClose} />);
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
