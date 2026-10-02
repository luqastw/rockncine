import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/room-code";
import { sameOrigin } from "@/lib/request";
import { rateLimitRequest } from "@/lib/rate-limit";

// P2002 = violação de unique (código sorteado já existia) — sorteia outro.
// Depois de algumas tentativas cai no `@default(cuid())` do schema, que nunca
// colide: melhor uma sala com código feio do que uma falha na criação.
async function createRoomWithShortCode(ownerId: string, name: string | null) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.room.create({
        data: { ownerId, name, code: generateRoomCode() },
      });
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
  }
  return prisma.room.create({ data: { ownerId, name } });
}

export async function POST(req: Request) {
  // Rota de escrita via POST nativo de `<form>` (não fetch): um site terceiro
  // consegue mandar o browser pra cá com um form POST cross-origin. Sem esta
  // checagem, um link malicioso criava salas na conta de quem clicasse.
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "origem não permitida." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 303: força o browser a fazer GET no redirect (307 preservaria o POST original)
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  // Criar sala é um INSERT por clique, e o botão já desabilita durante o envio
  // (CreateRoomForm) — o limite cobre o que o botão não cobre: reenvio do form
  // pelo browser, duplo clique no redirecionado, script automatizado com a
  // sessão da conta.
  const limited = rateLimitRequest(req, { scope: "room-create", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  const rawName = form?.get("name");
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 60) : null;

  const room = await createRoomWithShortCode(session.user.id, name);

  return NextResponse.redirect(new URL(`/rooms/${room.code}`, req.url), 303);
}
