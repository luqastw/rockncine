import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteCode } from "./InviteCode";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InviteCode", () => {
  it("mostra só asteriscos por padrão, do tamanho do código", () => {
    render(<InviteCode code="SDE35CBW" />);

    expect(screen.getByTestId("invite-code-mask").textContent).toBe("********");
  });

  it("expõe o código real a leitores de tela e esconde a máscara visual", () => {
    render(<InviteCode code="SDE35CBW" />);

    expect(document.getElementById("invite-code-text")?.textContent).toBe("SDE35CBW");
    expect(screen.getByTestId("invite-code-mask").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("invite-code-visible").getAttribute("aria-hidden")).toBe("true");
  });

  it("toque alterna a revelação", () => {
    render(<InviteCode code="SDE35CBW" />);
    const toggle = screen.getByRole("button", { name: "Mostrar código da sala" });

    expect(toggle.getAttribute("data-revealed")).toBe("false");
    fireEvent.click(toggle);

    const pressed = screen.getByRole("button", { name: "Ocultar código da sala" });
    expect(pressed.getAttribute("data-revealed")).toBe("true");
    expect(screen.getByTestId("invite-code-visible").textContent).toBe("SDE35CBW");
  });

  it("copiar envia o link completo, não o código", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<InviteCode code="SDE35CBW" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar link de convite" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/rooms/SDE35CBW`));
  });

  it("falha de cópia revela o código e seleciona o texto real", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("negado"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<InviteCode code="SDE35CBW" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar link de convite" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ocultar código da sala" })).toBeTruthy(),
    );
    expect(window.getSelection()?.toString()).toBe("SDE35CBW");
  });
});
