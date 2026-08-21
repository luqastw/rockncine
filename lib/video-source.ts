export type VideoSourceKind = "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME";

export type ResolvedVideo = {
  source: VideoSourceKind;
  embedUrl: string;
  sourceUrl: string;
};

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/;

const DRIVE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
];

export function extractYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractDriveId(url: string): string | null {
  for (const pattern of DRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Resolve via oEmbed público do Vimeo — extrai o videoId do iframe src retornado
// (ver SPEC.md seção 7, item 2). Sem chave de API, só o endpoint público.
async function resolveVimeo(rawUrl: string): Promise<string | null> {
  const match = rawUrl.match(VIMEO_PATTERN);
  if (!match) return null;

  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`,
    );
    if (!res.ok) return match[1]; // fallback: usa o id já extraído da URL
    const data: { html?: string } = await res.json();
    const idFromHtml = data.html?.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1];
    return idFromHtml ?? match[1];
  } catch {
    return match[1];
  }
}

export async function resolveVideoUrl(rawUrl: string): Promise<ResolvedVideo | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const normalized = url.toString();

  const youtubeId = extractYouTubeId(normalized);
  if (youtubeId) {
    return { source: "YOUTUBE", embedUrl: youtubeId, sourceUrl: normalized };
  }

  if (VIMEO_PATTERN.test(normalized)) {
    const vimeoId = await resolveVimeo(normalized);
    if (vimeoId) {
      return { source: "VIMEO", embedUrl: vimeoId, sourceUrl: normalized };
    }
  }

  const driveId = extractDriveId(normalized);
  if (driveId) {
    return {
      source: "GENERIC_IFRAME",
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      sourceUrl: normalized,
    };
  }

  // fallback universal: qualquer outro link https/http vira iframe genérico
  // (load-only, sem sync de play/pause/seek — ver SPEC.md seção 7).
  return { source: "GENERIC_IFRAME", embedUrl: normalized, sourceUrl: normalized };
}
