import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomClient } from "@/components/room/RoomClient";
import { getRoomByCode } from "@/lib/rooms";
import { requireSession } from "@/lib/session";

// Título com o nome da sala: era o mesmo "rockncine" do layout raiz para toda
// rota, então abas e histórico do navegador ficavam indistinguíveis entre
// salas. `getRoomByCode` é memoizado por requisição (`cache()`), então isto não
// vira uma segunda ida ao Postgres.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const room = await getRoomByCode(code);
  return { title: room?.name ? `${room.name} · rockncine` : "sala · rockncine" };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // O guard vive no layout, mas layout e page renderizam em paralelo no App
  // Router — a page não pode assumir que o layout já redirecionou. Antes daqui
  // saía `session!.user!.id`, que estourava em runtime em vez de redirecionar.
  const { userId, userName } = await requireSession();
  const room = await getRoomByCode(code);
  if (!room) notFound();

  return (
    <RoomClient
      roomCode={room.code}
      roomName={room.name}
      userId={userId}
      userName={userName}
      initialVideo={{
        source: room.videoSource,
        embedUrl: room.embedUrl,
        sourceUrl: room.videoSourceUrl,
      }}
    />
  );
}
