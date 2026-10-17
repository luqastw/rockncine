import {
  ScreenSharePresets,
  VideoPreset,
  type TrackPublishOptions,
} from "livekit-client";

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
//
// Cada preset carrega DUAS coisas, e as duas importam:
//   `preset.resolution` — o que se pede ao `getDisplayMedia` (captura);
//   `preset.encoding`   — o que se pede ao encoder de vídeo (publicação).
// Só a primeira era usada, e a segunda ficava no default do Livekit: 15 fps.
// `broadcastPublishOptions` é o que fecha essa ponta (FR-044).

export type BroadcastQualityLevel = "baixa" | "normal" | "fluida" | "alta";

export type BroadcastQuality = {
  level: BroadcastQualityLevel;
  /** Nome curto para a UI, minúsculo como o resto do app. */
  label: string;
  /** O que o preset custa, para a escolha não ser no escuro. */
  detail: string;
  preset: VideoPreset;
};

export const DEFAULT_BROADCAST_QUALITY: BroadcastQualityLevel = "normal";

// A ordem é a do custo de UPLOAD, não uma hierarquia de "melhor": `fluida` e
// `alta` custam quase o mesmo e compram coisas diferentes — a primeira compra
// quadros, a segunda compra pixels. Ordem crescente de banda é o que torna a
// lista legível como "quanto isso vai me custar".
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
  // 4 Mbps, 60fps, 720p. `ScreenSharePresets` não tem preset de 60fps — o topo
  // lá é `h1080fps30` — então este é construído aqui. Dobra os quadros sem
  // dobrar o bitrate por quadro: 4 Mbps a 60fps são os mesmos ~67 kbit por
  // quadro que 2 Mbps a 30fps, e a redundância temporal extra do VP8 a 60fps
  // sobra um pouco a favor. Só rende quando a FONTE produz 60 quadros — vídeo
  // 60fps, rolagem, UI animada; um filme 24fps entrega 24 quadros de qualquer
  // forma e este nível passa a custar banda sem devolver nada.
  fluida: {
    level: "fluida",
    label: "fluida",
    detail: "720p · 60fps · 4 Mbps",
    preset: new VideoPreset({
      width: 1280,
      height: 720,
      maxBitrate: 4_000_000,
      maxFramerate: 60,
      priority: "medium",
    }),
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

export const BROADCAST_QUALITY_LEVELS: BroadcastQualityLevel[] = ["baixa", "normal", "fluida", "alta"];

export function isBroadcastQualityLevel(value: unknown): value is BroadcastQualityLevel {
  return (
    typeof value === "string" && (BROADCAST_QUALITY_LEVELS as string[]).includes(value)
  );
}

export function broadcastQuality(level: BroadcastQualityLevel): BroadcastQuality {
  return BROADCAST_QUALITIES[level];
}

// As opções de PUBLICAÇÃO da track de tela, derivadas do preset escolhido.
//
// Elas não são detalhe interno do SDK: `resolution` alimenta as constraints do
// `getDisplayMedia` e PARA AÍ. O encoder recebe o que vem em
// `screenShareEncoding`, e sem ele o Livekit usa
// `publishDefaults.screenShareEncoding` — que é
// `ScreenSharePresets.h1080fps15.encoding`, **2,5 Mbps e 15 fps**. Era o teto
// real de todos os níveis: "normal" e "alta" pediam 30 quadros à captura e o
// encoder descartava metade deles. O sintoma era uma transmissão nítida e
// travada, com o seletor de qualidade parecendo inerte (FR-044/AC-027).
export function broadcastPublishOptions(quality: BroadcastQuality): TrackPublishOptions {
  return {
    screenShareEncoding: quality.preset.encoding,
    // O default do Livekit para screen share é `maintain-resolution`: sob
    // congestão o encoder corta QUADROS para preservar nitidez. É o oposto do
    // que um watch party quer. Das duas degradações, a barata é resolução:
    // borrão em movimento se lê como qualidade de vídeo, quadro faltando se lê
    // como transmissão quebrada — e é o que produz a imagem nítida e congelada.
    degradationPreference: "maintain-framerate",
    // Uma camada só. Com simulcast o host codifica DUAS vezes — a 60 fps isso é
    // o dobro de CPU, que é o recurso escasso justamente de quem transmite — e
    // o Livekit gera para screen share uma camada de 360p a 625 kbps, que é o
    // que o espectador recebe quando a banda aperta: o pior dos dois mundos,
    // borrado e sem quadros. A sala é pequena e a banda do host já é polida
    // pelo `screenShareEncoding` acima, então a camada extra não protege nada
    // (FR-046/AC-029).
    simulcast: false,
  };
}
