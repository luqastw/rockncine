import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/middleware", () => ({ withAuth: () => () => null }));

import { config } from "./proxy";

describe("proxy matcher", () => {
  it("protege /rooms e /profile", () => {
    expect(config.matcher).toContain("/rooms/:path*");
    expect(config.matcher).toContain("/profile");
  });
});
