import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { DeleteRoomButton } from "@/components/DeleteRoomButton";
import { SignOutButton } from "@/components/SignOutButton";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Stump } from "@/components/chrome/Stump";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sectionLabelClass } from "@/components/ui/SectionLabel";
import { cx } from "@/lib/cx";
import { SOURCE_LABEL } from "@/lib/video-source";

export const metadata: Metadata = { title: "suas salas · rockncine" };

const PAGE_SIZE = 20;

function formatWhen(date: Date) {
  const now = new Date();
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);

  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days > 1 && days < 7) return `há ${days} dias`;

  const mesmoAno = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(mesmoAno ? {} : { year: "2-digit" }),
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const paginaPedida = Number.parseInt((await searchParams)?.pagina ?? "1", 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  const memberships = userId
    ? await prisma.roomMember.findMany({
        where: { userId },
        orderBy: { room: { updatedAt: "desc" } },
        take: PAGE_SIZE + 1,
        skip: (pagina - 1) * PAGE_SIZE,
        select: {
          joinedAt: true,
          room: {
            select: {
              code: true,
              name: true,
              ownerId: true,
              updatedAt: true,
              videoSource: true,
            },
          },
        },
      })
    : [];

  const temProxima = memberships.length > PAGE_SIZE;
  const visiveis = temProxima ? memberships.slice(0, PAGE_SIZE) : memberships;

  return (
    <PageShell width="lg" chrome fog className="justify-safe-center gap-8">
      <h1 className="sr-only font-semibold tracking-tight">suas salas</h1>

      <Reveal as="header" className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption text-[var(--ink-muted)]">sua conta</span>
          <p className="truncate text-body-sm text-[var(--ink)]">
            {session?.user?.name ?? session?.user?.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href="/profile" variant="outline" size="sm">
            perfil
          </ButtonLink>
          <SignOutButton />
        </div>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Reveal as="div" className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className={sectionLabelClass}>entrar por código</h2>
            <JoinRoomForm />
          </Card>

          <Card tone="primary" className="flex flex-col gap-3 p-4">
            <h2 className={sectionLabelClass}>criar sala</h2>
            <CreateRoomForm />
          </Card>
        </Reveal>

        <Reveal as="section" className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className={sectionLabelClass}>suas salas</h2>
            {visiveis.length === 0 ? (
              pagina > 1 ? (
                <p className="text-body-sm text-[var(--ink-muted)]">não há mais salas nesta página.</p>
              ) : (
                <div
                  data-testid="rooms-empty"
                  className="flex flex-col items-center gap-3 py-8 text-center"
                >
                  <Stump className="size-20" />
                  <p className="text-body-sm text-[var(--ink-muted)]">
                    ninguém por aqui ainda. crie a primeira sala e chame o pessoal.
                  </p>
                </div>
              )
            ) : (
              <ul className="room-list flex flex-col divide-y divide-[var(--line)]">
                {visiveis.map(({ room }) => (
                  <li key={room.code} className="flex items-stretch">
                    <Link
                      href={`/rooms/${room.code}`}
                      className={cx(
                        "flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-2 py-3 transition-colors duration-150 hover:bg-[var(--bg-elevated)]",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--outline-strong)]",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body-sm text-[var(--ink)]">
                          {room.name || "sala sem nome"}
                        </span>
                        <span className="truncate font-mono text-caption text-[var(--ink-muted)]">
                          {room.code.toUpperCase()}
                          {room.videoSource ? ` · ${SOURCE_LABEL[room.videoSource]}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-caption text-[var(--ink-muted)]">
                        {room.ownerId === userId ? "sua · " : ""}
                        {formatWhen(room.updatedAt)}
                      </span>
                    </Link>
                    {room.ownerId === userId && (
                      <DeleteRoomButton roomCode={room.code} roomName={room.name} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(pagina > 1 || temProxima) && (
            <nav aria-label="páginas de salas" className="flex items-center justify-between gap-2">
              {pagina > 1 ? (
                <ButtonLink href={`/rooms?pagina=${pagina - 1}`} variant="outline" size="sm">
                  ← anteriores
                </ButtonLink>
              ) : (
                <span />
              )}
              <span className="font-mono text-caption text-[var(--ink-muted)]">página {pagina}</span>
              {temProxima ? (
                <ButtonLink href={`/rooms?pagina=${pagina + 1}`} variant="outline" size="sm">
                  mais →
                </ButtonLink>
              ) : (
                <span />
              )}
            </nav>
          )}
        </Reveal>
      </div>
    </PageShell>
  );
}
