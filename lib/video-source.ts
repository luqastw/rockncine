export type VideoSourceKind = "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME" | "DIRECT_MEDIA";

const DIRECT_MEDIA_RE = /\.(mp4|webm|m3u8)(\?|$)/i;
const HLS_RE = /\.m3u8(\?|$)/i;

// sniff de extensão só — sem HEAD/Content-Type (consistente com a regra de não
// fazer proxy/scraping de terceiro). URL assinada sem extensão visível cai no
// fallback GENERIC_IFRAME — limitação conhecida, ver SPEC.md seção 7.
export function isHlsUrl(url: string): boolean {
  return HLS_RE.test(url);
}

export type ResolvedVideo = {
  source: VideoSourceKind;
  embedUrl: string;
  sourceUrl: string;
};

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Parsing baseado em URL (hostname/pathname/searchParams) em vez de regex na
// string inteira — robusto a ordem de query params, domínios alternativos
// (m., music., -nocookie) e timestamps/params extras colados junto do link.
function parseYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^m\.|^music\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YT_ID_RE.test(id) ? id : null;
  }

  if (host !== "youtube.com" && host !== "www.youtube.com" && host !== "youtube-nocookie.com") {
    return null;
  }

  if (url.pathname === "/watch") {
    const v = url.searchParams.get("v");
    return v && YT_ID_RE.test(v) ? v : null;
  }

  const shorts = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shorts) return shorts[1];

  const embed = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];

  return null;
}

function parseVimeoIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^player\./, "");
  if (host !== "vimeo.com") return null;

  // pega o último grupo numérico longo do path — cobre vimeo.com/ID,
  // player.vimeo.com/video/ID e vimeo.com/channels/x/ID, vimeo.com/groups/x/videos/ID
  const matches = url.pathname.match(/\d{5,}/g);
  return matches ? matches[matches.length - 1] : null;
}

const DRIVE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
];

export function extractYouTubeId(rawUrl: string): string | null {
  try {
    return parseYouTubeId(new URL(rawUrl));
  } catch {
    return null;
  }
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
async function resolveVimeo(rawUrl: string, idFromUrl: string): Promise<string> {
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`,
    );
    if (!res.ok) return idFromUrl; // fallback: usa o id já extraído da URL
    const data: { html?: string } = await res.json();
    const idFromHtml = data.html?.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1];
    return idFromHtml ?? idFromUrl;
  } catch {
    return idFromUrl;
  }
}

// Colar da barra de endereço do Chrome ou de uma mensagem costuma vir sem
// esquema ("youtu.be/xyz", "www.youtube.com/watch?v=xyz") — `new URL` rejeita
// e o usuário recebia "link inválido." pra um link perfeitamente válido
// (achado 5 da auditoria). Tenta https:// antes de desistir; qualquer coisa
// que não vire URL nem assim continua sendo recusada.
function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawUrl)) return null; // tinha esquema e mesmo assim falhou
    try {
      const guessed = new URL(`https://${rawUrl}`);
      // sem ponto no host não é domínio, é texto solto ("filme legal") — sem
      // isso qualquer palavra digitada viraria um iframe genérico quebrado.
      return guessed.hostname.includes(".") ? guessed : null;
    } catch {
      return null;
    }
  }
}

// Guarda de protocolo pra qualquer ponto que renderize `embedUrl`/`sourceUrl`
// como `iframe src`/`a href` (GenericIframe.tsx, RoomExperience.tsx). Fecha o
// vetor de injeção mesmo quando o valor chega tainted por um caminho que não
// passou por `resolveVideoUrl` — ex. escrita direta no storage do Liveblocks
// por um client malicioso, que nenhuma validação de rota server-side alcança
// (achado 5, seção 11 do SPEC.md).
export function isSafeEmbedUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function resolveVideoUrl(rawUrl: string): Promise<ResolvedVideo | null> {
  const url = parseUrl(rawUrl);
  if (!url) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const normalized = url.toString();

  const youtubeId = parseYouTubeId(url);
  if (youtubeId) {
    return { source: "YOUTUBE", embedUrl: youtubeId, sourceUrl: normalized };
  }

  if (DIRECT_MEDIA_RE.test(url.pathname)) {
    return { source: "DIRECT_MEDIA", embedUrl: normalized, sourceUrl: normalized };
  }

  const vimeoIdFromUrl = parseVimeoIdFromUrl(url);
  if (vimeoIdFromUrl) {
    const vimeoId = await resolveVimeo(normalized, vimeoIdFromUrl);
    return { source: "VIMEO", embedUrl: vimeoId, sourceUrl: normalized };
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
