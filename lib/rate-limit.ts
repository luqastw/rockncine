// Rate limit em memória (janela fixa por identificador).
//
// LIMITAÇÃO CONHECIDA: o estado vive no processo. Em deploy serverless cada
// instância tem seu próprio contador, então o limite efetivo é
// `limit × nº de instâncias quentes`. Serve para barrar força bruta trivial e
// script de baixo esforço — não é garantia de cota. Para garantia real, trocar
// o `buckets` por store compartilhado (Postgres ou Redis).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// teto de memória: sem poda, um atacante que varia o IP faz o mapa crescer sem
// limite. Ao passar disso, varremos as entradas já expiradas.
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // se ainda estourar depois da poda, descarta tudo — melhor perder contadores
  // do que crescer sem limite
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

export function checkRateLimit(
  id: string,
  { limit, windowMs, now = Date.now() }: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) prune(now);
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

// visível para os testes: o estado é global do módulo e vaza entre casos.
export function resetRateLimitBuckets() {
  buckets.clear();
}

export function clientIpFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
): string {
  const read = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  // atrás do proxy da Vercel este header é escrito pela plataforma. Se a app
  // for exposta sem proxy confiável na frente, o cliente controla o valor e o
  // limite vira decorativo.
  const forwarded = read("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return read("x-real-ip") ?? "desconhecido";
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "muitas tentativas. tente de novo em instantes." },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}

export function rateLimitRequest(
  req: Request,
  { scope, limit, windowMs }: { scope: string; limit: number; windowMs: number },
): Response | null {
  const result = checkRateLimit(`${scope}:${clientIpFromHeaders(req.headers)}`, { limit, windowMs });
  return result.allowed ? null : tooManyRequests(result.retryAfterSeconds);
}
