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

export type SkewSample = {
  /** Desvio estimado, em ms, no instante da amostra. */
  skew: number;
  /** `Date.now()` local quando a amostra foi aceita. */
  at: number;
};

export type SkewSamples = Readonly<Record<string, SkewSample>>;

// Um `ts` absurdo (cliente malicioso ou relógio saltando) inflaria o desvio e
// empurraria a correção para muito além do fim do vídeo. O valor também é
// clampado pela duração em `expectedPlaybackTime`, então isto é defesa em
// profundidade, não a única barreira.
//
// 30s: mesma banda de `MAX_TS_DRIFT_MS` em `lib/playback/events.ts`, e pelo
// mesmo motivo. Antes eram 5 minutos, o que dava a um único evento forjado
// 4 minutos de deslocamento permanente na correção de drift dos outros.
export const MAX_SKEW_MS = 30 * 1000;

// Janela de validade de uma amostra.
//
// A regra "mantém a maior" é correta enquanto as amostras descrevem o mesmo
// instante. Ela não é um estimador que converge: um relógio que estava 4 s
// errado e depois se sincroniza por NTP deixa de gerar amostras próximas de
// 4 s, e o valor antigo continuaria valendo para o resto da sessão — o
// seguidor voltaria a ficar 4 s fora, que é exatamente o defeito que esta
// compensação existe para evitar.
//
// Esquecer a amostra depois de um tempo sem eventos do ator faz o valor
// decair para 0 (o comportamento antigo, sem compensação) em vez de ficar
// congelado num número que já não descreve nada. 10 minutos é longo o bastante
// para atravessar a sessão de uma sala sem perder a compensação de um
// espectador que fica em silêncio, e curto o bastante para que uma correção de
// relógio seja captada.
export const SKEW_TTL_MS = 10 * 60 * 1000;

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
  // Amostra vencida perde a autoridade: uma estimativa de 4 s feita há uma
  // hora não descreve o que o relógio do ator faz agora.
  const previous =
    current && localReceipt - current.at <= SKEW_TTL_MS ? current.skew : undefined;

  // `previous === undefined` (primeira amostra do ator, ou vencida) aceita
  // qualquer valor — inclusive NEGATIVO, que é o caso comum: o relógio de quem
  // age mais rápido que o local aparece como `ts - recebidoEm < 0`. Comparar
  // contra 0 aqui rejeitaria o primeiro evento de todo ator adiantado e o
  // ator nunca entraria na compensação.
  if (previous !== undefined && observed <= previous) return samples;

  return { ...samples, [actorId]: { skew: observed, at: localReceipt } };
}

// Sem amostra do ator (ou amostra vencida), devolve 0 — que é exatamente o
// comportamento antigo (sem compensação). A correção nunca piora por falta de
// dado.
export function skewFor(
  samples: SkewSamples,
  actorId: string | null | undefined,
  now: number = Date.now(),
): number {
  if (!actorId) return 0;
  const sample = samples[actorId];
  if (!sample) return 0;
  if (now - sample.at > SKEW_TTL_MS) return 0;
  return sample.skew;
}
