import { describe, expect, it } from "vitest";
import { parseChatEvent } from "@/lib/chat-event";

const NOW = 1_700_000_000_000;

function message(extra: Record<string, unknown> = {}) {
  return {
    type: "CHAT_MESSAGE",
    id: "m1",
    authorId: "user-1",
    authorName: "Ana",
    text: "oi",
    ts: NOW,
    ...extra,
  };
}

describe("parseChatEvent avatarV", () => {
  it("aceita mensagem sem avatarV e não cria o campo", () => {
    const parsed = parseChatEvent(message(), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("avatarV");
  });

  it("preserva avatarV inteiro positivo", () => {
    expect(parseChatEvent(message({ avatarV: 42 }), NOW)).toMatchObject({ avatarV: 42 });
  });

  it.each([
    ["javascript:alert(1)"],
    ["https://evil.example/a.png"],
    [{ a: 1 }],
    [1.5],
    [-3],
    [0],
    [Number.NaN],
    ["123"],
  ])("aceita a mensagem e omite avatarV inválido %j", (avatarV) => {
    const parsed = parseChatEvent(message({ avatarV }), NOW);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("avatarV");
  });
});

describe("parseChatEvent validações existentes", () => {
  it("rejeita text vazio", () => {
    expect(parseChatEvent(message({ text: "" }), NOW)).toBeNull();
  });

  it("rejeita ts fora da banda", () => {
    expect(parseChatEvent(message({ ts: NOW + 60_000 }), NOW)).toBeNull();
  });

  it("rejeita authorId ausente", () => {
    expect(parseChatEvent(message({ authorId: undefined }), NOW)).toBeNull();
  });
});
