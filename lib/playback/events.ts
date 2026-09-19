import type { PlayerEvent } from "@/liveblocks.config";
import type { VideoSourceKind } from "@/lib/video-source";

// Teto sanitário de posição. `time` vem de outro cliente e vira
// `currentTime`/`seekTo` direto; um valor absurdo (ou Infinity disfarçado)
// quebrava o player de todo mundo que recebia o evento.
const MAX_POSITION_S = 12 * 60 * 60;

export function isVideoSourceKind(value: unknown): value is VideoSourceKind {
  return (
    value === "YOUTUBE" ||
    value === "VIMEO" ||
    value === "DIRECT_MEDIA" ||
    value === "GENERIC_IFRAME"
  );
}

// Validação de fronteira: o payload chega de outro cliente (qualquer membro
// escreve no broadcast). Nada aqui confia no formato — ou o evento passa
// inteiro, ou é descartado.
export function parsePlayerEvent(value: unknown): PlayerEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (raw.type !== "PLAY" && raw.type !== "PAUSE" && raw.type !== "SEEK") return null;
  if (typeof raw.actorId !== "string" || raw.actorId.length === 0) return null;
  if (typeof raw.ts !== "number" || !Number.isFinite(raw.ts)) return null;
  if (typeof raw.time !== "number" || !Number.isFinite(raw.time)) return null;
  if (raw.time < 0 || raw.time > MAX_POSITION_S) return null;
  if (!isVideoSourceKind(raw.source)) return null;

  return {
    type: raw.type,
    time: raw.time,
    actorId: raw.actorId,
    ts: raw.ts,
    source: raw.source,
  };
}

export type ApplyContext = {
  selfId: string;
  localSource: VideoSourceKind | null;
  lastAppliedTs: number | null;
};

// Decide se um evento remoto (já validado) deve ser aplicado ao player local.
//
// Três descartes, cada um cobrindo um defeito real:
//   1. eco — a origem já aplicou localmente; reaplicar gera loop de feedback.
//   2. fonte trocou — sem `source` no evento, um PLAY emitido quando a sala
//      estava no Vimeo era aplicado no player do YouTube recém-carregado,
//      buscando no conteúdo errado.
//   3. atrasado/duplicado — o broadcast não garante ordem. Sem comparar `ts`,
//      um PAUSE antigo que chegava depois de um SEEK novo rebobinava a sala
//      contra o snapshot mais recente do próprio storage (last-write-wins).
export function shouldApplyPlayerEvent(event: PlayerEvent, ctx: ApplyContext): boolean {
  if (event.actorId === ctx.selfId) return false;
  if (event.source !== ctx.localSource) return false;
  if (ctx.lastAppliedTs !== null && event.ts <= ctx.lastAppliedTs) return false;
  return true;
}
