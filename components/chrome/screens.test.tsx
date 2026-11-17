import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { roomMember: { findMany } } }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/components/SignOutButton", () => ({ SignOutButton: () => null }));
vi.mock("@/components/DeleteRoomButton", () => ({ DeleteRoomButton: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { getServerSession } from "next-auth";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import RoomsPage from "@/app/rooms/page";
import { ProfileAvatarForm } from "@/components/ProfileAvatarForm";

describe("telas de formulário", () => {
  it("AC-014: login e cadastro dentro de moldura", () => {
    for (const Page of [LoginPage, RegisterPage]) {
      const { container, unmount } = render(<Page />);
      const form = container.querySelector("form");
      expect(form?.closest(".frame")).not.toBeNull();
      unmount();
    }
  });

  it("AC-005: /rooms lista as salas em cartões chanfrados e sem superfície de pergaminho", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "eu", name: "eu" } } as never);
    findMany.mockResolvedValue([
      {
        joinedAt: new Date(),
        room: {
          code: "MINHA123",
          name: "minha sala",
          ownerId: "eu",
          videoSource: "YOUTUBE",
          updatedAt: new Date(),
        },
      },
    ]);
    const { container } = render(await RoomsPage({ searchParams: Promise.resolve({}) }));
    expect(container.querySelectorAll(".parchment").length).toBe(0);
    const list = container.querySelector("ul.room-list");
    expect(list).not.toBeNull();
    const cards = list?.querySelectorAll(":scope > li > a.frame") ?? [];
    expect(cards.length).toBe(1);
  });

  it("FR-016: preview de avatar circular ≥ 160px em /profile", () => {
    const { container } = render(<ProfileAvatarForm userId="u1" initialAvatarV={null} />);
    const preview = container.querySelector("[data-avatar-preview]");
    expect(preview?.className).toContain("rounded-full");
    expect(preview?.className).toContain("size-40");
  });
});
