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

type PlayerSnapshot = { isPlaying: boolean; currentTime: number; updatedAt: number };

// Posição esperada pra quem chega depois (late join) e pra correção de drift.
// Duas proteções que não existiam (achado 10 da auditoria):
//   - staleness: ninguém escreve `isPlaying: false` ao fechar a aba, então uma
//     sala abandonada durante a reprodução fica com o storage travado em
//     "tocando". Sem isto, reabrir a sala horas depois calculava
//     `currentTime + horas` e buscava muito além do fim do vídeo.
//   - clamp por duração: nunca buscar depois do fim do material.
export function expectedPlaybackTime(
  snapshot: PlayerSnapshot,
  duration: number,
): { time: number; shouldPlay: boolean; stale: boolean } {
  const elapsedMs = Date.now() - snapshot.updatedAt;
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
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
};
