export type VideoSourceKind = "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME";

export type ResolvedVideo = {
  source: VideoSourceKind;
  embedUrl: string;
  sourceUrl: string;
};

// Fase 2 do MVP: só YouTube — valida o mecanismo de sync antes de generalizar
// (Vimeo/Drive/genérico entram na fase 4, ver SPEC.md seção 7).
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
];

export function extractYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function resolveVideoUrl(rawUrl: string): ResolvedVideo | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const videoId = extractYouTubeId(url.toString());
  if (videoId) {
    return {
      source: "YOUTUBE",
      embedUrl: videoId,
      sourceUrl: url.toString(),
    };
  }

  return null;
}
