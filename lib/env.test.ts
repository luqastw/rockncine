import { afterEach, describe, expect, it } from "vitest";
import { liveblocksSecretKey } from "./env";

const original = process.env.LIVEBLOCKS_SECRET_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.LIVEBLOCKS_SECRET_KEY;
  else process.env.LIVEBLOCKS_SECRET_KEY = original;
});

describe("liveblocksSecretKey", () => {
  it("devolve null quando ausente", () => {
    delete process.env.LIVEBLOCKS_SECRET_KEY;
    expect(liveblocksSecretKey()).toBeNull();
  });

  it("devolve null quando só tem espaços", () => {
    process.env.LIVEBLOCKS_SECRET_KEY = "   ";
    expect(liveblocksSecretKey()).toBeNull();
  });

  it("devolve o valor sem espaços nas pontas", () => {
    process.env.LIVEBLOCKS_SECRET_KEY = "  sk_test  ";
    expect(liveblocksSecretKey()).toBe("sk_test");
  });

  it("lê a variável a cada chamada", () => {
    process.env.LIVEBLOCKS_SECRET_KEY = "a";
    expect(liveblocksSecretKey()).toBe("a");
    process.env.LIVEBLOCKS_SECRET_KEY = "b";
    expect(liveblocksSecretKey()).toBe("b");
  });
});
