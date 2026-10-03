import { ScreenSharePresets, type VideoPreset } from "livekit-client";

// Qualidade da transmissão de tela.
//
// A escolha é do HOST e é LOCAL a ele, de propósito: o upload do host é o
// recurso escasso, e a qualidade não é propriedade da sala. Colocar no storage
// do Liveblocks daria a qualquer membro o direito de degradar a transmissão dos
// outros — a mesma classe de griefing que a spec 12 já documenta para
// `storage.broadcast`.
//
// `contentHint` fica fixo em `motion` e não é uma opção: pela spec WebRTC,
// `detail` manda o encoder preservar detalhe **ao custo da taxa de quadros**, e
// foi feito para texto e arte vetorial. Para vídeo é o oposto do que serve, e o
// próprio Livekit força `motion` em screen share porque o caminho `detail` é
// "untested/buggy". A qualidade aqui é resolution/bitrate, que é a alavanca
// certa para travar.

export type BroadcastQualityLevel = "baixa" | "normal" | "alta";

export type BroadcastQuality = {
  level: BroadcastQualityLevel;
  /** Nome curto para a UI, minúsculo como o resto do app. */
  label: string;
  /** O que o preset custa, para a escolha não ser no escuro. */
  detail: string;
  preset: VideoPreset;
};

export const DEFAULT_BROADCAST_QUALITY: BroadcastQualityLevel = "normal";

export const BROADCAST_QUALITIES: Record<BroadcastQualityLevel, BroadcastQuality> = {
  // 1.5 Mbps, 15fps. Para uplink fraco: corta metade dos quadros em vez de
  // cortar a resolução inteira, porque resolution baixa em vídeo parece
  // borrão e 15fps parece travamento — o mesmo sintoma que estamos tentando
  // eliminar.
  baixa: {
    level: "baixa",
    label: "baixa",
    detail: "720p · 15fps · 1,5 Mbps",
    preset: ScreenSharePresets.h720fps15,
  },
  // 2 Mbps, 30fps. Mesmo FPS do topo, 40% da banda. Para vídeo, 720p a 30fps é
  // visualmente quase indistinguível de 1080p a 30fps na distância de uma sala —
  // e é o padrão porque não custa taxa de quadros, que é o que aparece como
  // "travado".
  normal: {
    level: "normal",
    label: "normal",
    detail: "720p · 30fps · 2 Mbps",
    preset: ScreenSharePresets.h720fps30,
  },
  // 5 Mbps, 30fps. Só faz sentido com uplink folgado; em banda apertada vira
  // frames descartados, que é o defeito em vez da cura.
  alta: {
    level: "alta",
    label: "alta",
    detail: "1080p · 30fps · 5 Mbps",
    preset: ScreenSharePresets.h1080fps30,
  },
};

export const BROADCAST_QUALITY_LEVELS: BroadcastQualityLevel[] = ["baixa", "normal", "alta"];

export function isBroadcastQualityLevel(value: unknown): value is BroadcastQualityLevel {
  return (
    typeof value === "string" && (BROADCAST_QUALITY_LEVELS as string[]).includes(value)
  );
}

export function broadcastQuality(level: BroadcastQualityLevel): BroadcastQuality {
  return BROADCAST_QUALITIES[level];
}
