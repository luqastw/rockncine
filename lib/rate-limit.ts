import { memoryRateLimitStore, resetMemoryRateLimitStore } from "@/lib/rate-limit-memory";
import { postgresRateLimitStore } from "@/lib/rate-limit-postgres";
import type { RateLimitStore } from "@/lib/rate-limit-store";

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

function activeStore(): RateLimitStore {
  return process.env.RATE_LIMIT_STORE === "memory" ? memoryRateLimitStore : postgresRateLimitStore;
}

export async function checkRateLimit(
  id: string,
  { limit, windowMs, now }: { limit: number; windowMs: number; now?: number },
): Promise<RateLimitResult> {
  try {
    const { count, remainingMs } = await activeStore().hit(id, windowMs, now);
    if (count > limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
    }
    return { allowed: true, remaining: limit - count };
  } catch (error) {
    console.error("rate limit indisponível, requisição liberada", error);
    return { allowed: true, remaining: limit };
  }
}

export function resetRateLimitBuckets() {
  resetMemoryRateLimitStore();
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
    { error: "Muitas tentativas. Tente de novo em instantes." },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}

export async function rateLimitRequest(
  req: Request,
  { scope, limit, windowMs }: { scope: string; limit: number; windowMs: number },
): Promise<Response | null> {
  const result = await checkRateLimit(`${scope}:${clientIpFromHeaders(req.headers)}`, { limit, windowMs });
  return result.allowed ? null : tooManyRequests(result.retryAfterSeconds);
}

export async function rateLimitUser(
  userId: string,
  { scope, limit, windowMs }: { scope: string; limit: number; windowMs: number },
): Promise<Response | null> {
  const result = await checkRateLimit(`${scope}:user:${userId}`, { limit, windowMs });
  return result.allowed ? null : tooManyRequests(result.retryAfterSeconds);
}
