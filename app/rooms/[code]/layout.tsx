import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // busca tolerante a caixa sem ILIKE: `mode: "insensitive"` vira ILIKE no
  // Postgres e trata `%`/`_` no segmento de URL cru como curinga — bypass de
  // autorização real (achado 1, seção 11 do SPEC.md). Duas comparações de
  // igualdade exata cobrem o mesmo caso de uso (código curto ditado em
  // qualquer caixa, `lib/room-code.ts`, e cuid antigo digitado como está).
  const room = await prisma.room.findFirst({
    where: { OR: [{ code }, { code: code.toUpperCase() }] },
  });
  if (!room) notFound();

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
    update: {},
    create: { roomId: room.id, userId: session.user.id },
  });

  return <>{children}</>;
}
