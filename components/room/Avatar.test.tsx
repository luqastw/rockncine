import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Avatar } from "./Avatar";

function getImg(container: HTMLElement) {
  return container.querySelector("img") as HTMLImageElement;
}

function srcOf(img: HTMLImageElement) {
  const url = new URL(img.getAttribute("src") ?? "", "http://localhost");
  return `${url.pathname}${url.search}`;
}

describe("Avatar", () => {
  it("usa a rota do avatar com avatarV válido", () => {
    const { container } = render(<Avatar userId="user_1" avatarV={3} size="sm" />);
    expect(srcOf(getImg(container))).toBe("/api/avatar/user_1?v=3");
  });

  it.each([undefined, null, Number.NaN, 0, -1])(
    "usa o padrão com avatarV %s",
    (v) => {
      const { container } = render(<Avatar userId="user_1" avatarV={v} size="sm" />);
      expect(srcOf(getImg(container))).toBe("/avatar-default.webp");
    },
  );

  it("usa o padrão com userId inválido", () => {
    const { container } = render(<Avatar userId="../x" avatarV={3} size="sm" />);
    expect(srcOf(getImg(container))).toBe("/avatar-default.webp");
  });

  it("cai para o padrão no erro e não entra em loop no segundo erro", () => {
    const { container } = render(<Avatar userId="user_1" avatarV={3} size="sm" />);
    const img = getImg(container);
    fireEvent.error(img);
    expect(srcOf(getImg(container))).toBe("/avatar-default.webp");
    expect(() => fireEvent.error(getImg(container))).not.toThrow();
    expect(srcOf(getImg(container))).toBe("/avatar-default.webp");
  });

  it("tenta a nova URL ao mudar avatarV após falha", () => {
    const { container, rerender } = render(
      <Avatar userId="user_1" avatarV={3} size="sm" />,
    );
    fireEvent.error(getImg(container));
    expect(srcOf(getImg(container))).toBe("/avatar-default.webp");
    rerender(<Avatar userId="user_1" avatarV={4} size="sm" />);
    expect(srcOf(getImg(container))).toBe("/api/avatar/user_1?v=4");
  });

  it("aplica as classes e dimensões de cada tamanho", () => {
    const sm = render(<Avatar userId="user_1" size="sm" />);
    const smImg = getImg(sm.container);
    expect(smImg.className).toContain("h-5 w-5");
    expect(smImg.getAttribute("width")).toBe("20");
    const md = render(<Avatar userId="user_1" size="md" />);
    const mdImg = getImg(md.container);
    expect(mdImg.className).toContain("h-7 w-7");
    expect(mdImg.getAttribute("height")).toBe("28");
  });
});
