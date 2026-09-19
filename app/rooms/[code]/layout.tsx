import { prisma } from "@/lib/prisma";
import { getRoomByCode } from "@/lib/rooms";
import { requireSession } from "@/lib/session";

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { userId } = await requireSession();
  const room = await getRoomByCode(code);

  // Sem `notFound()` aqui: chamado dentro de um layout, ele borbulha pro
  // not-found do segmento PAI, não pro `app/rooms/[code]/not-found.tsx`
  // deste segmento — o 404 específico de sala nunca renderizava (achado 1
  // da revisão de consistência). `page.tsx` faz a mesma busca e chama
  // `notFound()` de dentro do próprio segmento, onde o arquivo colocalizado
  // é de fato usado. Aqui só pulamos o upsert quando a sala não existe.
  if (room) {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: {},
      create: { roomId: room.id, userId },
    });
  }

  return <>{children}</>;
}
