import { describe, expect, it, vi } from "vitest";
import { extractYouTubeId, isSafeEmbedUrl, resolveVideoUrl } from "./video-source";

describe("extractYouTubeId", () => {
  it("extrai id de youtu.be", () => {
    expect(extractYouTubeId("https://youtu.be/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });

  it("extrai id de youtube.com/watch", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10s")).toBe(
      "aqz-KE-bpKQ",
    );
  });

  it("extrai id de /shorts/", () => {
    expect(extractYouTubeId("https://youtube.com/shorts/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });

  it("retorna null pra domínio não-YouTube", () => {
    expect(extractYouTubeId("https://vimeo.com/76979871")).toBeNull();
  });

  it("retorna null pra URL malformada", () => {
    expect(extractYouTubeId("não é uma url")).toBeNull();
  });
});

describe("resolveVideoUrl", () => {
  it("aceita link sem esquema (achado 5 da auditoria) preenchendo https://", async () => {
    const resolved = await resolveVideoUrl("youtu.be/aqz-KE-bpKQ");
    expect(resolved).toEqual({
      source: "YOUTUBE",
      embedUrl: "aqz-KE-bpKQ",
      sourceUrl: "https://youtu.be/aqz-KE-bpKQ",
    });
  });

  it("rejeita texto solto sem ponto no host", async () => {
    expect(await resolveVideoUrl("filme legal")).toBeNull();
  });

  it("rejeita esquema não-http(s) — vetor do achado 5 (injeção de embedUrl)", async () => {
    expect(await resolveVideoUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(await resolveVideoUrl("javascript:alert(1)")).toBeNull();
  });

  it("reconhece .mp4 como DIRECT_MEDIA", async () => {
    const resolved = await resolveVideoUrl("https://example.com/video.mp4?x=1");
    expect(resolved).toEqual({
      source: "DIRECT_MEDIA",
      embedUrl: "https://example.com/video.mp4?x=1",
      sourceUrl: "https://example.com/video.mp4?x=1",
    });
  });

  it("cai no fallback GENERIC_IFRAME pra link https genérico", async () => {
    const resolved = await resolveVideoUrl("https://example.com/player.html?id=1");
    expect(resolved).toEqual({
      source: "GENERIC_IFRAME",
      embedUrl: "https://example.com/player.html?id=1",
      sourceUrl: "https://example.com/player.html?id=1",
    });
  });

  it("resolve Google Drive pra /preview", async () => {
    const resolved = await resolveVideoUrl(
      "https://drive.google.com/file/d/ABC123/view?usp=sharing",
    );
    expect(resolved?.source).toBe("GENERIC_IFRAME");
    expect(resolved?.embedUrl).toBe("https://drive.google.com/file/d/ABC123/preview");
  });

  it("resolve Vimeo via fallback quando oEmbed falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const resolved = await resolveVideoUrl("https://vimeo.com/76979871");
    expect(resolved).toEqual({
      source: "VIMEO",
      embedUrl: "76979871",
      sourceUrl: "https://vimeo.com/76979871",
    });
    vi.unstubAllGlobals();
  });
});

describe("isSafeEmbedUrl", () => {
  it("aceita http/https", () => {
    expect(isSafeEmbedUrl("https://example.com")).toBe(true);
    expect(isSafeEmbedUrl("http://example.com")).toBe(true);
  });

  it("recusa data:/javascript: e URL malformada — mesmo vetor do achado 5", () => {
    expect(isSafeEmbedUrl("data:text/html,<h1>x</h1>")).toBe(false);
    expect(isSafeEmbedUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeEmbedUrl("não é uma url")).toBe(false);
  });
});
