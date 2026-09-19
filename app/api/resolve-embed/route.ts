import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveVideoUrl } from "@/lib/video-source";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "não autenticado." }, { status: 401 });
  }

  // resolveVideoUrl faz fetch de saída (oEmbed do Vimeo) — sem limite, uma
  // sessão autenticada transforma a rota em amplificador de requisições.
  const limited = rateLimitRequest(req, { scope: "resolve-embed", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url obrigatória." }, { status: 400 });
  }

  const resolved = await resolveVideoUrl(url);
  if (!resolved) {
    return NextResponse.json({ error: "link inválido." }, { status: 422 });
  }

  return NextResponse.json(resolved);
}
