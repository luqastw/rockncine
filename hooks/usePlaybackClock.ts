"use client";

// Relógio de reprodução fora do estado do React.
//
// O defeito que isto resolve: `currentTime` vivia em `useState` dentro dos
// hooks de sync, que são chamados no corpo de `RoomExperience`. Cada tick de
// `timeupdate` (nativo ~4 Hz), do polling do YouTube (`TIME_POLL_MS = 400`,
// 2,5 Hz) ou do evento do Vimeo re-renderizava o componente de 621 linhas E
// toda a subárvore: `Chat` com até 30 `<li>`, `PresenceList`, `SyncRing`,
// `InviteCode`, `LastActionNote`, `PlayerControls`. Quatro vezes por segundo,
// o log de chat inteiro reconcilia sem que nada nele tivesse mudado.
//
// `useSyncExternalStore` com seletor resolve: só o componente que assina
// `currentTime` re-renderiza. A store é um módulo — o mesmo relógio serve aos
// três hooks, e o valor corrente é legível a qualquer momento (inclusive por
// código imperativo, que é o que o drift correction precisa).
//
// A notificação é separada por grupo: `currentTime` não avisa quem assina o
// resto, e vice-versa. É essa separação que tira `Chat` e `PresenceList` do
// caminho quente — eles só precisam do segundo grupo.

import { useSyncExternalStore } from "react";

export type PlaybackSnapshot = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  error: string | null;
};

const INITIAL: PlaybackSnapshot = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 1,
  isMuted: false,
  error: null,
};

let snapshot: PlaybackSnapshot = INITIAL;

// Grupo do playhead: o único que muda a 2,5–4 Hz.
const timeListeners = new Set<() => void>();
// Grupo do resto: play/pause, duração, volume, mute, erro. Frequência baixa.
const stateListeners = new Set<() => void>();

type StateOnly = Omit<PlaybackSnapshot, "currentTime">;

function stateOf(s: PlaybackSnapshot): StateOnly {
  return {
    duration: s.duration,
    isPlaying: s.isPlaying,
    volume: s.volume,
    isMuted: s.isMuted,
    error: s.error,
  };
}

function sameState(a: StateOnly, b: StateOnly): boolean {
  return (
    a.duration === b.duration &&
    a.isPlaying === b.isPlaying &&
    a.volume === b.volume &&
    a.isMuted === b.isMuted &&
    a.error === b.error
  );
}

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

/**
 * Atualiza o relógio e notifica cada grupo só quando o que ele assina mudou.
 *
 * Sem a checagem de igualdade, um `setCurrentTime` repetindo o mesmo valor
 * (o `seek` do PlayerControls, o `setCurrentTime(seconds)` logo antes de um
 * evento) acordaria a todos os assinantes à toa.
 */
export function setPlayback(next: Partial<PlaybackSnapshot>): void {
  const previous = snapshot;
  const merged: PlaybackSnapshot = { ...previous, ...next };
  if (previous.currentTime === merged.currentTime && sameState(stateOf(previous), stateOf(merged))) {
    return;
  }
  snapshot = merged;

  if (previous.currentTime !== merged.currentTime) notify(timeListeners);
  if (!sameState(stateOf(previous), stateOf(merged))) notify(stateListeners);
}

/**
 * Leitura imperativa, para o código que não é React: o drift correction
 * precisa do `currentTime` dentro de um `setInterval` sem assinar nada, e o
 * handler de teclado precisa do valor no instante da tecla.
 */
export function getPlaybackSnapshot(): PlaybackSnapshot {
  return snapshot;
}

/**
 * Zera ao sair da sala.
 *
 * Sem isto, o próximo `RoomExperience` que montasse leria o playhead da sala
 * anterior no primeiro render — antes do primeiro tick do player novo — e o
 * scrubber mostraria a posição errada por uma fração de segundo.
 */
export function resetPlaybackClock(): void {
  setPlayback(INITIAL);
}

function subscribeTime(listener: () => void): () => void {
  timeListeners.add(listener);
  return () => {
    timeListeners.delete(listener);
  };
}

function subscribeState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

const getTime = () => snapshot.currentTime;
const getDuration = () => snapshot.duration;
const getIsPlaying = () => snapshot.isPlaying;
const getVolume = () => snapshot.volume;
const getIsMuted = () => snapshot.isMuted;
const getError = () => snapshot.error;

/**
 * Assina o playhead. É o hook do `PlayerControls` — o único lugar do app em
 * que o tempo importa a cada quadro.
 */
export function useCurrentTime(): number {
  return useSyncExternalStore(subscribeTime, getTime, getTime);
}

/**
 * Assina o estado de baixa frequência: play/pause, duração, volume, mute,
 * erro. `Chat`, `PresenceList` e `SyncRing` NÃO assinam isto — nenhum deles
 * reage ao playhead, e é por isso que saem do caminho de 4 Hz.
 */
export function usePlaybackState(): StateOnly {
  // Uma assinatura por campo, e não uma do objeto: o hook do React compara o
  // resultado com `Object.is`, e um objeto novo a cada chamada re-renderiza
  // sempre. Além disso, cada campo tem sua própria granularidade de notifica.
  const duration = useSyncExternalStore(subscribeState, getDuration, getDuration);
  const isPlaying = useSyncExternalStore(subscribeState, getIsPlaying, getIsPlaying);
  const volume = useSyncExternalStore(subscribeState, getVolume, getVolume);
  const isMuted = useSyncExternalStore(subscribeState, getIsMuted, getIsMuted);
  const error = useSyncExternalStore(subscribeState, getError, getError);
  return { duration, isPlaying, volume, isMuted, error };
}
