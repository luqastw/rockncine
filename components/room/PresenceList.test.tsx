import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Presence = { userId: string; name: string; avatarV?: number | null };

const mocks = vi.hoisted(() => ({
  others: [] as Array<{ presence: Presence | null }>,
  mine: { userId: "eu", name: "ana" } as Presence,
}));

vi.mock("@liveblocks/react", () => ({
  useOthers: () => mocks.others,
  useMyPresence: () => [mocks.mine, vi.fn()],
}));

import { PresenceList, PresenceTrigger } from "./PresenceList";

function srcs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img")).map((img) => {
    const url = new URL(img.getAttribute("src") ?? "", "http://localhost");
    return url.pathname + url.search;
  });
}

describe("PresenceList", () => {
  beforeEach(() => {
    mocks.mine = { userId: "eu", name: "ana" };
    mocks.others = [];
  });

  it("mostra imagem de quem tem e padrão de quem não tem (AC-021)", () => {
    mocks.mine = { userId: "eu", name: "ana", avatarV: 3 };
    mocks.others = [
      { presence: { userId: "bruno", name: "bruno", avatarV: 5 } },
      { presence: { userId: "carla", name: "carla" } },
    ];
    const { container } = render(<PresenceList expanded myUserId="eu" myName="ana" />);
    expect(srcs(container)).toEqual([
      "/api/avatar/eu?v=3",
      "/api/avatar/bruno?v=5",
      "/avatar-default.webp",
    ]);
  });

  it("cai no padrão com avatarV inválido ou nulo", () => {
    mocks.others = [
      { presence: { userId: "bruno", name: "bruno", avatarV: "javascript:alert(1)" as unknown as number } },
      { presence: { userId: "carla", name: "carla", avatarV: null } },
    ];
    const { container } = render(<PresenceList expanded myUserId="eu" myName="ana" />);
    expect(srcs(container)).toEqual([
      "/avatar-default.webp",
      "/avatar-default.webp",
      "/avatar-default.webp",
    ]);
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("usa myAvatarV quando informado e deduplica por usuário", () => {
    mocks.others = [
      { presence: { userId: "bruno", name: "bruno", avatarV: 1 } },
      { presence: { userId: "bruno", name: "bruno", avatarV: 2 } },
    ];
    const { container } = render(
      <PresenceList expanded myUserId="eu" myName="ana" myAvatarV={9} />,
    );
    expect(srcs(container)).toEqual(["/api/avatar/eu?v=9", "/api/avatar/bruno?v=2"]);
  });

  it("o gatilho mostra o avatar próprio", () => {
    mocks.mine = { userId: "eu", name: "ana", avatarV: 4 };
    const { container } = render(
      <PresenceTrigger expanded={false} onToggle={() => {}} myUserId="eu" myName="ana" />,
    );
    expect(srcs(container)).toEqual(["/api/avatar/eu?v=4"]);
  });
});
