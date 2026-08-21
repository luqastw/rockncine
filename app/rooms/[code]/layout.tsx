import { redirect } from "next/navigation";
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
  // autorização real (achado 1, docs/specs/04-auditoria-ui-ux-rodada-2/spec.md). Duas comparações de
  // igualdade exata cobrem o mesmo caso de uso (código curto ditado em
  // qualquer caixa, `lib/room-code.ts`, e cuid antigo digitado como está).
  const room = await prisma.room.findFirst({
    where: { OR: [{ code }, { code: code.toUpperCase() }] },
  });

  // Sem `notFound()` aqui: chamado dentro de um layout, ele borbulha pro
  // not-found do segmento PAI, não pro `app/rooms/[code]/not-found.tsx`
  // deste segmento — o 404 específico de sala nunca renderizava (achado 1
  // da revisão de consistência). `page.tsx` faz a mesma busca e chama
  // `notFound()` de dentro do próprio segmento, onde o arquivo colocalizado
  // é de fato usado. Aqui só pulamos o upsert quando a sala não existe.
  if (room) {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
      update: {},
      create: { roomId: room.id, userId: session.user.id },
    });
  }

  return <>{children}</>;
}
