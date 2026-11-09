import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveVideoUrl } from "@/lib/video-source";
import { sameOrigin } from "@/lib/request";
import { rateLimitUser } from "@/lib/rate-limit";
import { findRoomForMember } from "@/lib/room-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  // Mesma checagem do DELETE em app/api/rooms/[code]/route.ts. O risco de CSRF
  // aqui é baixo (o corpo precisa ser JSON, o que exige preflight) mas não
  // zero: um `Content-Type` não-simples num fetch cross-origin passa sem
  // preflight em alguns caminhos, e a rota é de escrita. A assimetria não se
  // justifica — as duas rotas mexem em dados do dono.
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "origem não permitida." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "não autenticado." }, { status: 401 });
  }

  const limited = rateLimitUser(session.user.id, {
    scope: "room-video",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { code } = await params;
  const body = await req.json().catch(() => null);
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : null;
  if (!sourceUrl) {
    return NextResponse.json({ error: "payload inválido." }, { status: 400 });
  }

  const access = await findRoomForMember(code, session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  const { room } = access;

  // `source`/`embedUrl` nunca são aceitos do client — eram gravados sem
  // nenhuma validação de conteúdo (achado 2, docs/specs/05-code-review-seguranca/spec.md), permitindo
  // persistir um `embedUrl` arbitrário (ex. `data:text/html,...`) que depois
  // ia direto pro `iframe src`/`a href` de todo mundo que reabrisse a sala.
  // Só `sourceUrl` é aceito; `source`/`embedUrl` são sempre re-derivados
  // aqui, pelo mesmo caminho de validação usado em `/api/resolve-embed`.
  const resolved = await resolveVideoUrl(sourceUrl);
  if (!resolved) {
    return NextResponse.json({ error: "link inválido." }, { status: 400 });
  }

  await prisma.room.update({
    where: { id: room.id },
    data: {
      videoSource: resolved.source,
      embedUrl: resolved.embedUrl,
      videoSourceUrl: resolved.sourceUrl,
    },
  });

  return NextResponse.json({ ok: true });
}
