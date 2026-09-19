// Tipos de preferência de qualidade do player, em um só lugar.
//
// Estavam redefinidos inline em cinco arquivos (`useVideoQuality`,
// `useNativeVideoSync`, `useVimeoSync`, `playerController`, `PlayerControls`) —
// bastava acrescentar um nível de resolução para ter que caçar as cinco
// definições, com o compilador aceitando cada uma delas independentemente.

export type Resolution = "720p" | "480p";

export type FpsLimit = "auto" | "30" | "60";

export const RESOLUTIONS: readonly Resolution[] = ["720p", "480p"];

export const FPS_LIMITS: readonly FpsLimit[] = ["auto", "30", "60"];
