import type { FpsLimit, Resolution } from "@/lib/playback/types";

// Formato comum que todo hook de sync (YouTube/Vimeo/mídia nativa) retorna —
// PlayerControls não sabe qual backend está por trás, só chama esses métodos.
// Chamar play()/pause()/seek() aqui não precisa de broadcast próprio: os
// listeners que cada hook já registra (onStateChange, player.on(...), eventos
// nativos de <video>) capturam a mudança de estado resultante e disparam
// commitPlayer+broadcast como já fazem hoje — a barra é só mais um chamador
// da mesma API imperativa que os SDKs expõem.
// Depois de quanto tempo sem ninguém tocar no player o snapshot de
// `storage.player` deixa de valer como "está tocando agora".
export const STALE_SNAPSHOT_MS = 5 * 60 * 1000;

// Constantes de sincronização compartilhadas entre os hooks de sync.
// YouTube tem latência intrínseca maior (iframe API, rede), então o threshold
// de drift é 2x maior que para <video> nativo — evita seeks automáticos
// indesejados (spec 08, CA1.1/CA1.3).
export const DRIFT_THRESHOLD_NATIVE_S = 1.5;
export const DRIFT_THRESHOLD_YOUTUBE_S = 3.0;
export const CHECK_INTERVAL_MS = 3000;
export const SEEK_WHILE_PAUSED_THRESHOLD_S = 2;
// Timeout de fallback para applyRemote quando a API não retorna Promise
// (YouTube IFrame API, <video> nativo). Vimeo resolve por Promise.
export const REMOTE_APPLY_COOLDOWN_MS = 1500;

type PlayerSnapshot = { isPlaying: boolean; currentTime: number; updatedAt: number };

// Posição esperada pra quem chega depois (late join) e pra correção de drift.
// Três proteções:
//   - compensação de relógio (`skewMs`): `updatedAt` foi gravado com o relógio
//     de QUEM agiu, e `Date.now()` aqui é o relógio local. Sem descontar a
//     diferença, `elapsedMs` embutia o skew das duas máquinas e o seguidor
//     ficava permanentemente fora por esse valor (ver lib/playback/clock.ts).
//     Sem amostra do ator, skewMs = 0 — o comportamento antigo, nunca pior.
//   - staleness: ninguém escreve `isPlaying: false` ao fechar a aba, então uma
//     sala abandonada durante a reprodução fica com o storage travado em
//     "tocando". Sem isto, reabrir a sala horas depois calculava
//     `currentTime + horas` e buscava muito além do fim do vídeo.
//   - clamp por duração: nunca buscar depois do fim do material.
export function expectedPlaybackTime(
  snapshot: PlayerSnapshot,
  duration: number,
  skewMs = 0,
): { time: number; shouldPlay: boolean; stale: boolean } {
  const elapsedMs = Date.now() + skewMs - snapshot.updatedAt;
  const stale = elapsedMs > STALE_SNAPSHOT_MS;
  const shouldPlay = snapshot.isPlaying && !stale;
  const raw = snapshot.currentTime + (shouldPlay ? elapsedMs / 1000 : 0);
  const ceiling = duration > 0 ? Math.max(duration - 0.5, 0) : Number.POSITIVE_INFINITY;
  return { time: Math.min(Math.max(raw, 0), ceiling), shouldPlay, stale };
}

export type PlaybackController = {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0–1, só local, nunca sincroniza (mesma regra de Presence.isMuted)
  isMuted: boolean; // só local
  error: string | null;
  // Preferência de resolução **efetiva**, ou `null` quando a fonte não permite
  // limitar qualidade (YouTube decide sozinho; `.mp4` não tem nível; Safari usa
  // HLS nativo sem nos deixar escolher). É o gate do botão nos controles.
  //
  // Não há `setResolution`/`setFpsLimit` aqui de propósito: essas preferências
  // são estado global do app (hooks/useVideoQuality) e não do player — os
  // setters chegam aos controles como props, vindos de quem é dono do estado.
  // Os campos existiam nos três hooks sempre como `undefined`, e o botão
  // ficava habilitado (`resolution !== null`) com `onClick` indefinido.
  resolution: Resolution | null;
  fpsLimit: FpsLimit;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
};
