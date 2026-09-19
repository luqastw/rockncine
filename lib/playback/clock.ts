// Estimativa de desvio entre o relógio de outro participante e o local.
//
// O defeito que isto corrige: `storage.player.updatedAt` é gravado com o
// `Date.now()` de quem agiu, e lido como `Date.now()` de quem assiste. Sem
// compensação, `elapsedMs` embute a diferença entre as duas máquinas — um
// seguidor com relógio 4 s atrás ficava 4 s à frente da sala para sempre, e o
// desvio só aparecia de novo a cada troca de autoridade.
//
// Como o desvio é estimado SEM protocolo novo: todo evento carrega o `ts` do
// remetente (relógio dele) e é recebido em algum instante do relógio local.
//
//   ts - recebidoEm = desvio - latência
//
// A latência é sempre >= 0, então cada amostra é uma cota INFERIOR do desvio
// real, e a maior amostra observada é a mais próxima da verdade (a de menor
// latência). O erro residual fica limitado à latência de uma via (~dezenas a
// poucas centenas de ms), contra segundos de erro sem compensação nenhuma.
//
// Não é NTP: não há round-trip nem mediana. É a estimativa barata que o stream
// de eventos que já existe permite.

export type SkewSamples = Readonly<Record<string, number>>;

// Um `ts` absurdo (cliente malicioso ou relógio saltando) inflaria o desvio e
// empurraria a correção para muito além do fim do vídeo. Como o valor também é
// clampado pela duração em `expectedPlaybackTime`, isto é defesa em
// profundidade, não a única barreira.
const MAX_SKEW_MS = 5 * 60 * 1000;

export function updateSkew(
  samples: SkewSamples,
  actorId: string,
  remoteTs: number,
  localReceipt: number,
): SkewSamples {
  if (!Number.isFinite(remoteTs) || !Number.isFinite(localReceipt)) return samples;

  const observed = remoteTs - localReceipt;
  if (Math.abs(observed) > MAX_SKEW_MS) return samples;

  const current = samples[actorId];
  if (current !== undefined && observed <= current) return samples;

  return { ...samples, [actorId]: observed };
}

// Sem amostra do ator, devolve 0 — que é exatamente o comportamento antigo
// (sem compensação). A correção nunca piora por falta de dado.
export function skewFor(samples: SkewSamples, actorId: string | null | undefined): number {
  if (!actorId) return 0;
  return samples[actorId] ?? 0;
}
