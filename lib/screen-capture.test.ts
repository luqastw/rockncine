import { describe, expect, it } from "vitest";
import { SCREEN_CAPTURE_OPTIONS, classifyPublishError } from "./screen-capture";

function named(name: string): Error {
  const error = new Error("x");
  error.name = name;
  return error;
}

describe("classifyPublishError", () => {
  it("NotAllowedError é cancelamento", () => {
    expect(classifyPublishError(named("NotAllowedError")).kind).toBe("denied");
  });

  it("TrackInvalidError é captura sem quadros", () => {
    expect(classifyPublishError(named("TrackInvalidError")).kind).toBe("invalid");
  });

  it.each([new Error("boom"), "texto", null, undefined])("o resto é falha de publicação (%s)", (error) => {
    const result = classifyPublishError(error);
    expect(result.kind).toBe("failed");
    expect(result.message).toContain("LIVEKIT_URL");
  });
});

describe("SCREEN_CAPTURE_OPTIONS", () => {
  it("exclui a própria aba e usa motion", () => {
    expect(SCREEN_CAPTURE_OPTIONS.selfBrowserSurface).toBe("exclude");
    expect(SCREEN_CAPTURE_OPTIONS.contentHint).toBe("motion");
    expect(SCREEN_CAPTURE_OPTIONS.audio).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });
});
