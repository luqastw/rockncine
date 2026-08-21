import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/room-code";

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 303: força o browser a fazer GET no redirect (307 preservaria o POST original)
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const form = await req.formData().catch(() => null);
  const rawName = form?.get("name");
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 60) : null;

  const room = await createRoomWithShortCode(session.user.id, name);

  return NextResponse.redirect(new URL(`/rooms/${room.code}`, req.url), 303);
}
