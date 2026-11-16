import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileAvatarForm } from "./ProfileAvatarForm";

const posts: unknown[] = [];

class FakeChannel {
  postMessage(message: unknown) {
    posts.push(message);
  }
  close() {}
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function pick(size = 10, type = "image/png") {
  const input = screen.getByLabelText(/escolher imagem/i) as HTMLInputElement;
  const file = new File([new Uint8Array(size)], "a.png", { type });
  fireEvent.change(input, { target: { files: [file] } });
}

function avatarImage() {
  return screen.getByAltText("Prévia da imagem de perfil") as HTMLImageElement;
}

describe("ProfileAvatarForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    posts.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("preview circular com contorno fairy e diametro por variante", () => {
    const { container, rerender } = render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    const preview = container.querySelector("[data-avatar-preview]");
    expect(preview?.className).toContain("rounded-full");
    expect(preview?.className).toContain("outline-[var(--fairy)]");
    expect(preview?.className).toContain("size-40");
    rerender(<ProfileAvatarForm userId="u1" initialAvatarV={null} stacked />);
    const stackedPreview = container.querySelector("[data-avatar-preview]");
    expect(stackedPreview?.className).toContain("rounded-full");
    expect(stackedPreview?.className).toContain("outline-[var(--fairy)]");
    expect(stackedPreview?.className).toContain("size-30");
  });

  it("envio ok atualiza o avatar e posta a versao", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { v: 123 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(avatarImage().src).toContain("/api/avatar/u1?v=123"));
    expect(posts).toEqual([{ v: 123 }]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profile/image");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it.each([
    [413, "Imagem muito grande (máx 2 MB)."],
    [415, "formato não suportado."],
    [429, "muitas tentativas. aguarde."],
    [400, "arquivo inválido."],
  ])("status %i mostra a mensagem do servidor", async (status, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: message }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(posts).toEqual([]);
  });

  it("falha de rede mostra a mensagem de rede", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Não foi possível enviar. Tente de novo.",
    );
  });

  it("duplo clique dispara um unico fetch", async () => {
    let resolve: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    const button = screen.getByRole("button", { name: "Enviar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviando..." }).getAttribute("aria-busy")).toBe(
      "true",
    );
    resolve(jsonResponse(200, { v: 5 }));
    await waitFor(() => expect(avatarImage().src).toContain("v=5"));
  });

  it("arquivo acima de 2 MB nao dispara fetch", () => {
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick(2_097_153);
    expect(screen.getByRole("alert").textContent).toBe("Imagem muito grande (máx 2 MB).");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remover chama DELETE, volta ao padrao e posta null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={7} />);
    expect(avatarImage().src).toContain("/api/avatar/u1?v=7");
    fireEvent.click(screen.getByRole("button", { name: "Remover imagem" }));
    await waitFor(() => expect(avatarImage().src).toContain("/avatar-default.webp"));
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(posts).toEqual([{ v: null }]);
    expect(
      (screen.getByRole("button", { name: "Remover imagem" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sem BroadcastChannel nao quebra", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    fetchMock.mockResolvedValue(jsonResponse(200, { v: 9 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(avatarImage().src).toContain("v=9"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
