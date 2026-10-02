"use client";

// Tipos mínimos do bundle do hls.js, declarados localmente em vez de importar
// o pacote.
//
// O motivo é o peso: `import Hls from "hls.js"` no topo de
// `useNativeVideoSync.ts` colocava ~494 KB raw / 148 KB gzip dentro do chunk
// da rota `/rooms/[code]` — 53% do JavaScript que a sala baixa. E como
// `RoomExperience` instancia os três hooks de sync incondicionalmente, uma
// sala de YouTube pagava esse valor por um player que nunca executa.
//
// A alternativa é `await import("hls.js")` dentro do efeito, atrás de
// `isHlsUrl(url)`. Isso deixa o pacote num chunk próprio, baixado só quando a
// fonte é HLS de verdade.
//
// O que segue é a superfície que `useNativeVideoSync` realmente usa. É
// deliberadamente incompleta: declarar o que não é usado é o que mantém o
// contrato honesto, e o compilador passa a apontar quando um uso novo
// aparecer.

// `hls.js` é o namespace com o default e os enums. Só o que o hook toca:
//
//   - `Hls.isSupported()`  — capability do browser
//   - `Hls.Events.ERROR` / `Hls.Events.MANIFEST_PARSED` — nomes de evento
//   - `new Hls()`          — instância
//
// Os enums viram literais reais de string (ver `node_modules/hls.js`), não
// números: o `Events` do hls.js é um enum de string.
export interface HlsStatic {
  new (config?: unknown): Hls;
  isSupported(): boolean;
  Events: {
    ERROR: "hlsError";
    MANIFEST_PARSED: "hlsManifestParsed";
  };
}

export interface HlsLevel {
  height: number;
  bitrate: number;
}

export interface HlsErrorData {
  fatal: boolean;
  type: string;
  details: string;
}

export interface Hls {
  levels: HlsLevel[];
  autoLevelCapping: number;
  currentLevel: number;
  // `config` é o objeto de configuração mutável do hls.js. O hook escreve
  // `maxMaxBufferLength` nele para encurtar o buffer (é o mecanismo usado
  // para o limite de FPS — ver o aviso de RISCO no hook). O tipo é `unknown`
  // de propósito: o hook já faz o cast consciente do risco, e declarar a
  // forma interna aqui seria um comment de um private que muda a cada release.
  readonly config: Record<string, unknown>;
  loadSource(url: string): void;
  attachMedia(media: HTMLMediaElement): void;
  destroy(): void;
  on(event: string, handler: (event: string, data: unknown) => void): void;
}

// Carregador do módulo, injetável para teste.
export type HlsLoader = () => Promise<HlsStatic>;

export const HLS_MODULE: HlsLoader = () =>
  import("hls.js").then((mod) => mod.default as unknown as HlsStatic);

// RISCO: `maxMaxBufferLength` é propriedade interna do config do hls.js, não
// API pública. Funciona em hls.js 1.7.x (o config é objeto mutável lido pelo
// stream controller a cada ciclo), mas pode quebrar em updates. Monitorar
// mudanças em:
// https://github.com/video-dev/hls.js/blob/master/src/config.ts
// Fallback: se removida, a limitação de FPS via buffer deixa de funcionar (sem
// impacto na resolução ou no ABR — apenas mais frames processados).
//
// O valor padrão do hls.js é 600 (segundos). Passar `undefined` — o que o
// código fazia antes ao desfazer o limite — não restaura o default: o
// buffer-controller faz `Math.min(maxBufLen, config.maxMaxBufferLength)`, e
// `Math.min(x, undefined)` é `NaN`. Com `NaN`, a comparação
// `bufferLen >= maxBufLen` é sempre falsa e o stream-controller nunca fica
// ocioso, puxando fragmentos sem parar. Por isso o reset passa o default
// explícito.
export const HLS_DEFAULT_MAX_BUFFER_LENGTH = 600;

export function setMaxBufferLength(hls: Hls, seconds: number | null): void {
  hls.config.maxMaxBufferLength = seconds ?? HLS_DEFAULT_MAX_BUFFER_LENGTH;
}
