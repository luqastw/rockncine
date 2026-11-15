import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileAvatarModal } from "@/components/room/ProfileAvatarModal";

describe("ProfileAvatarModal", () => {
  it("não renderiza nada fechado", () => {
    render(<ProfileAvatarModal userId="u1" avatarV={null} open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre com o formulário e fecha por Escape e pelo botão", () => {
    const onClose = vi.fn();
    render(<ProfileAvatarModal userId="u1" avatarV={null} open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "imagem de perfil" })).toBeTruthy();
    expect(screen.getByLabelText(/escolher imagem/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
