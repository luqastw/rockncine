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

  // busca insensível a caixa: o código curto (lib/room-code.ts) existe pra ser
  // ditado, e quem digita raramente acerta a caixa. O `Room.code` do banco
  // continua sendo a forma canônica usada no link e no id do Liveblocks.
  const room = await prisma.room.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
  });
  if (!room) notFound();

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
    update: {},
    create: { roomId: room.id, userId: session.user.id },
  });

  return <>{children}</>;
}
