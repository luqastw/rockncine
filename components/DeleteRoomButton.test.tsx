import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteRoomButton } from "./DeleteRoomButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const jsonResponse = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const triggerButton = () => screen.getByRole("button", { name: "Excluir sala festa de aniversário" });

const openDialog = async () => {
  fireEvent.click(triggerButton());
  return screen.findByRole("dialog");
};

describe("DeleteRoomButton — abertura do modal", () => {
  it("AC-009: abre dialog modal com o nome, o código e as duas ações, e leva o foco para dentro", async () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("festa de aniversário");
    expect(dialog.textContent).toContain("ABCD1234");
    expect(within(dialog).getByRole("button", { name: "cancelar" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Excluir sala" })).toBeTruthy();

    // Regressão: o diálogo é portal para o `body`. Dentro do `<li>` da lista,
    // que anima com `transform`, o `position: fixed` ficava preso ao item e o
    // painel era recortado no meio da lista.
    expect(dialog.parentElement?.parentElement).toBe(document.body);

    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("o foco inicial vai para 'cancelar', não para o botão destrutivo", async () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();

    await waitFor(() => {
      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "cancelar" }));
    });
  });
});

describe("DeleteRoomButton — variant danger", () => {
  it("gatilho e confirmação usam variant danger", () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);
    const gatilho = screen.getByRole("button", { name: /excluir sala/i });
    expect(gatilho.className).toContain("border-[var(--heart)]");
    expect(gatilho.className).not.toContain("text-[var(--ink");
    fireEvent.click(gatilho);
    const confirmar = screen
      .getAllByRole("button", { name: "Excluir sala" })
      .find((el) => el.closest('[role="dialog"]'));
    expect(confirmar?.className).toContain("border-[var(--heart)]");
    expect(confirmar?.className).not.toContain("border-[var(--line");
    expect(confirmar?.className).not.toContain("text-[var(--ink");
  });
});

describe("DeleteRoomButton — fechamento", () => {
  it("AC-010: Escape fecha o modal e devolve o foco ao botão que o abriu", async () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const trigger = triggerButton();
    const dialog = await openDialog();
    expect(dialog).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("clicar no overlay fecha o modal", async () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.mouseDown(dialog.parentElement!);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("mantém o ciclo de Tab dentro do painel (FR-013)", async () => {
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    const cancel = within(dialog).getByRole("button", { name: "cancelar" });
    const confirm = within(dialog).getByRole("button", { name: "Excluir sala" });

    // Tab no último focável volta para o primeiro…
    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    // …e Shift+Tab no primeiro vai para o último.
    cancel.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });
});

describe("DeleteRoomButton — resposta do servidor", () => {
  it("AC-012: durante a requisição os dois botões do modal ficam desabilitados", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir sala" }));

    await waitFor(() => {
      const cancel = within(dialog).getByRole("button", { name: "cancelar" }) as HTMLButtonElement;
      const confirm = within(dialog).getByRole("button", { name: "Excluindo..." }) as HTMLButtonElement;
      expect(cancel.disabled).toBe(true);
      expect(confirm.disabled).toBe(true);
    });
  });

  it("AC-011: 403 mantém o modal aberto e mostra a mensagem em role=alert", async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: "Só o dono pode excluir esta sala." }));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir sala" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Só o dono pode excluir esta sala.");
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(triggerButton()).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-019: 200 fecha o modal e atualiza a lista", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir sala" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-013: 404 fecha o modal, sem alerta de erro, e atualiza a lista", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Sala não encontrada." }));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir sala" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("falha de rede mantém o modal aberto com mensagem retryable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName="festa de aniversário" />);

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir sala" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Verifique sua conexão");
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("usa o código como identificação quando a sala não tem nome", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<DeleteRoomButton roomCode="ABCD1234" roomName={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir sala ABCD1234" }));
    const dialog = await screen.findByRole("dialog");

    expect(dialog.textContent).toContain("ABCD1234");
  });
});
