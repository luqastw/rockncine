import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { JoinRoomForm } from "./JoinRoomForm";

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("JoinRoomForm", () => {
  it("envia o código em maiúsculas e sem espaços", () => {
    render(<JoinRoomForm />);
    fireEvent.change(screen.getByLabelText("Código da sala"), { target: { value: "  8f3k2m " } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(push).toHaveBeenCalledWith("/rooms/8F3K2M");
  });

  it("não navega com o campo vazio", () => {
    render(<JoinRoomForm />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("o input exibe em maiúsculas", () => {
    render(<JoinRoomForm />);
    expect(screen.getByLabelText("Código da sala").className).toContain("uppercase");
  });
});
