import { describe, expect, it } from "vitest";
import { generateRoomCode } from "./room-code";

describe("generateRoomCode", () => {
  it("gera 8 caracteres por padrão", () => {
    expect(generateRoomCode()).toHaveLength(8);
  });

  it("nunca usa caracteres ambíguos (0/O, 1/I/L, U) — a busca em app/rooms/[code]/layout.tsx normaliza pra maiúsculo, então o alfabeto precisa ser só maiúsculo", () => {
    const code = generateRoomCode(200);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    expect(code).not.toMatch(/[0O1ILU]/);
    expect(code).toBe(code.toUpperCase());
  });
});
