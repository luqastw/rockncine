"use client";

// Tipos mínimos do SDK do Vimeo, declarados localmente em vez de importar o
// pacote.
//
// Mesmo motivo do hls.js (`lib/hls.ts`): `import Player from "@vimeo/player"`
// no topo de `useVimeoSync.ts` colocava ~24 KB raw dentro do chunk da rota
// `/rooms/[code]`, e o hook é instanciado incondicionalmente por
// `RoomExperience` — uma sala de YouTube pagava isso por um player que nunca
// executa.
//
// O SDK do Vimeo não exporta tipos utilizáveis para o consumo dinâmico
// (`export =` no CommonJS, sem namespace de tipos), então o que segue é a
// superfície que `useVimeoSync` realmente usa. Declarar só o que é usado é o
// que mantém o contrato honesto: um uso novo vira erro de compilação aqui, e
// não uma surpresa em produção.
//
// O construtor é usado como `new Player(container, options)` e a instância
// também é capturada por `instanceof` nos testes, então a forma abaixo
// declara o que o SDK expõe nos dois papéis.

export interface VimeoQuality {
  id: string;
  width: number;
  height: number;
}

export interface VimeoPlayerOptions {
  id?: number | string;
  url?: string;
  controls?: boolean;
  max_quality?: string;
  responsive?: boolean;
}

export interface VimeoPlayer {
  // Estado
  getDuration(): Promise<number>;
  getCurrentTime(): Promise<number>;
  getVolume(): Promise<number>;
  getMuted(): Promise<boolean>;
  getQualities(): Promise<VimeoQuality[]>;
  getVideoId(): Promise<number>;
  getPlaybackRate(): Promise<number>;

  // Comando
  play(): Promise<void>;
  pause(): Promise<void>;
  setCurrentTime(seconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setQuality(quality: string): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  loadVideo(id: number | string): Promise<number>;

  destroy(): Promise<void>;
  // O payload real de cada evento depende do nome ("play"/"pause" mandam
  // `seconds`, "error" manda `message`, "timeupdate" manda os dois). O hook
  // narrowa com cast no ponto de uso, que é onde a forma é conhecida — daqui
  // o handler recebe `unknown` e o compilador obriga a tratar.
  on(event: VimeoEventName, handler: (data: VimeoEventData) => void): void;
  off(event: VimeoEventName, handler: (data: VimeoEventData) => void): void;
  ready(): Promise<void>;
}

export interface VimeoPlayerCtor {
  new (element: HTMLElement | string, options?: VimeoPlayerOptions): VimeoPlayer;
  // `isVimeoUrl` é estático no SDK e usado internamente pelo `loadVideo`.
  isVimeoUrl(url: string): boolean;
}

// Carregador do módulo, injetável para teste. O SDK é CommonJS (`export =`),
// então o shape do namespace precisa ser normalizado: em build o default vem
// como `.default`, em dev pode vir direto.
export type VimeoLoader = () => Promise<VimeoPlayerCtor>;

export const VIMEO_MODULE: VimeoLoader = () =>
  import("@vimeo/player").then((mod) => {
    const ns = mod as unknown as { default?: VimeoPlayerCtor } & VimeoPlayerCtor;
    return (ns.default ?? ns) as VimeoPlayerCtor;
  });

// Os eventos que o hook escuta, com o payload que ele realmente lê. O SDK
// entrega `unknown`; narrowed aqui para o que é usado, com o resto descartado
// em quem chama.
export type VimeoEventName = "error" | "play" | "pause" | "seeked" | "timeupdate";

export interface VimeoEventData {
  seconds?: number;
  duration?: number;
  message?: string;
  [key: string]: unknown;
}
