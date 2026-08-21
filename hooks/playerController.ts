// Formato comum que todo hook de sync (YouTube/Vimeo/mídia nativa) retorna —
// PlayerControls não sabe qual backend está por trás, só chama esses métodos.
// Chamar play()/pause()/seek() aqui não precisa de broadcast próprio: os
// listeners que cada hook já registra (onStateChange, player.on(...), eventos
// nativos de <video>) capturam a mudança de estado resultante e disparam
// commitPlayer+broadcast como já fazem hoje — a barra é só mais um chamador
// da mesma API imperativa que os SDKs expõem.
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
