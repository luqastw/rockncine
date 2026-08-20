import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getServerSession(authOptions);

  const room = await prisma.room.findUniqueOrThrow({
    where: { code },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          sala
        </span>
        <h1 className="font-mono text-2xl text-[var(--ink)]">{room.code}</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          criada por {room.owner.name ?? room.owner.email}
        </p>
      </header>

      <section
        className="flex aspect-video w-full items-center justify-center rounded-lg border border-[var(--ember)]/40 bg-[var(--bg-surface)] text-[var(--ink-muted)]"
        aria-label="player de vídeo"
      >
        player entra na fase 2 (sync via Liveblocks)
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          participantes — {room.members.length}
        </h2>
        <ul className="flex flex-col gap-2">
          {room.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              <span
                className="h-2 w-2 rounded-full bg-[var(--ember)]"
                aria-hidden
              />
              {member.user.name ?? member.user.email}
              {member.user.id === session?.user?.id && (
                <span className="text-xs text-[var(--ink-muted)]">(você)</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
