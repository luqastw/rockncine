import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("@liveblocks/react", () => ({
  LiveblocksProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RoomProvider: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    captured.props = props;
    return <div>{props.children}</div>;
  },
}));
vi.mock("@/components/room/LiveblocksBadgeA11y", () => ({ LiveblocksBadgeA11y: () => null }));

import { RoomLiveblocksProvider } from "./RoomLiveblocksProvider";

const VIDEO = { source: null, embedUrl: null, sourceUrl: null };

function renderProvider(extra: { avatarV?: number | null } = {}) {
  render(
    <RoomLiveblocksProvider roomCode="SALA1234" userId="eu" userName="ana" initialVideo={VIDEO} {...extra}>
      <span />
    </RoomLiveblocksProvider>,
  );
  return captured.props?.initialPresence as Record<string, unknown>;
}

beforeEach(() => {
  captured.props = null;
});

describe("RoomLiveblocksProvider initialPresence", () => {
  it("inclui avatarV numérico", () => {
    expect(renderProvider({ avatarV: 123 })).toEqual({ userId: "eu", name: "ana", avatarV: 123 });
  });

  it("null é valor válido e é propagado", () => {
    expect(renderProvider({ avatarV: null })).toEqual({ userId: "eu", name: "ana", avatarV: null });
  });

  it("undefined omite o campo", () => {
    const presence = renderProvider();
    expect(presence).toEqual({ userId: "eu", name: "ana" });
    expect("avatarV" in presence).toBe(false);
  });
});
