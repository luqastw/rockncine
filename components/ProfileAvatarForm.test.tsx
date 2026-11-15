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
  const input = screen.getByLabelText(/escolher imagem/) as HTMLInputElement;
  const file = new File([new Uint8Array(size)], "a.png", { type });
  fireEvent.change(input, { target: { files: [file] } });
}

function avatarImage() {
  return screen.getByAltText("prévia da imagem de perfil") as HTMLImageElement;
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

  it("envio ok atualiza o avatar e posta a versao", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { v: 123 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "enviar" }));
    await waitFor(() => expect(avatarImage().src).toContain("/api/avatar/u1?v=123"));
    expect(posts).toEqual([{ v: 123 }]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profile/image");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it.each([
    [413, "imagem muito grande (máx 2 MB)."],
    [415, "formato não suportado."],
    [429, "muitas tentativas. aguarde."],
    [400, "arquivo inválido."],
  ])("status %i mostra a mensagem do servidor", async (status, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: message }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(posts).toEqual([]);
  });

  it("falha de rede mostra a mensagem de rede", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "não foi possível enviar. tente de novo.",
    );
  });

  it("duplo clique dispara um unico fetch", async () => {
    let resolve: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    const button = screen.getByRole("button", { name: "enviar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "enviando..." }).getAttribute("aria-busy")).toBe(
      "true",
    );
    resolve(jsonResponse(200, { v: 5 }));
    await waitFor(() => expect(avatarImage().src).toContain("v=5"));
  });

  it("arquivo acima de 2 MB nao dispara fetch", () => {
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick(2_097_153);
    expect(screen.getByRole("alert").textContent).toBe("imagem muito grande (máx 2 MB).");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remover chama DELETE, volta ao padrao e posta null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={7} />);
    expect(avatarImage().src).toContain("/api/avatar/u1?v=7");
    fireEvent.click(screen.getByRole("button", { name: "remover imagem" }));
    await waitFor(() => expect(avatarImage().src).toContain("/avatar-default.webp"));
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(posts).toEqual([{ v: null }]);
    expect(
      (screen.getByRole("button", { name: "remover imagem" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sem BroadcastChannel nao quebra", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    fetchMock.mockResolvedValue(jsonResponse(200, { v: 9 }));
    render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "enviar" }));
    await waitFor(() => expect(avatarImage().src).toContain("v=9"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
