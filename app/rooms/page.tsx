import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { SignOutButton } from "@/components/SignOutButton";

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // salas em que o usuário é membro — `RoomMember` já era populado no acesso à
  // sala, mas nunca era lido: fechou a aba sem anotar o código e a sala estava
  // perdida, apesar de a spec dizer que ela "permanece indefinidamente"
  // (achado 7 da auditoria).
  const memberships = userId
    ? await prisma.roomMember.findMany({
        where: { userId },
        orderBy: { joinedAt: "desc" },
        take: 20,
        select: {
          joinedAt: true,
          room: { select: { code: true, name: true, ownerId: true } },
        },
      })
    : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">rockncine</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {session?.user?.name ?? session?.user?.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          criar sala
        </h2>
        <CreateRoomForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          entrar por código
        </h2>
        <JoinRoomForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          suas salas
        </h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            nenhuma sala ainda — crie uma acima ou entre por código.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map(({ room, joinedAt }) => (
              <li key={room.code}>
                <Link
                  href={`/rooms/${room.code}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 hover:border-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-[var(--ink)]">
                      {room.name || "sala sem nome"}
                    </span>
                    <span className="font-mono text-xs text-[var(--ink-muted)]">{room.code}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--ink-muted)]">
                    {room.ownerId === userId ? "sua · " : ""}
                    {formatDate(joinedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
