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
import { Fairy } from "@/components/chrome/Fairy";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sectionLabelClass } from "@/components/ui/SectionLabel";
import { cx } from "@/lib/cx";
import { SOURCE_LABEL } from "@/lib/video-source";

export const metadata: Metadata = { title: "Suas salas · Rockncine" };

const PAGE_SIZE = 20;

function formatWhen(date: Date) {
  const now = new Date();
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);

  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days > 1 && days < 7) return `Há ${days} dias`;

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

  const nome = session?.user?.name ?? session?.user?.email;

  return (
    <PageShell
      width="lg"
      chrome
      fog
      className="gap-10"
      actions={
        <>
          <ButtonLink href="/profile" variant="ghost" size="sm">
            Perfil
          </ButtonLink>
          <SignOutButton />
        </>
      }
    >
      <Reveal as="header" className="flex flex-col gap-1">
        <h1 className="font-display text-title font-semibold tracking-tight text-[var(--ink)]">
          Olá, {nome}
        </h1>
        <p className="text-body text-[var(--ink-muted)]">
          Entre numa sala pelo código ou crie uma nova.
        </p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Reveal as="div" className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className={sectionLabelClass}>Entrar por código</h2>
            <JoinRoomForm />
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className={sectionLabelClass}>Criar sala</h2>
            <CreateRoomForm />
          </Card>
        </Reveal>

        <Reveal as="section" className="flex min-w-0 flex-col gap-4">
          <Card
            data-surface="parchment"
            className="parchment flex flex-col gap-4 p-5 text-[var(--parchment-ink)]"
          >
            <h2 className="border-b-[3px] border-double border-[var(--line)] pb-2 font-display text-heading font-semibold text-[var(--parchment-ink)]">Suas salas</h2>
            {visiveis.length === 0 ? (
              pagina > 1 ? (
                <p className="text-body text-[var(--parchment-ink)]">Não há mais salas nesta página.</p>
              ) : (
                <div
                  data-testid="rooms-empty"
                  className="flex flex-col items-center gap-3 py-8 text-center"
                >
                  <Fairy className="size-20" />
                  <p className="text-body text-[var(--parchment-ink)]">
                    Ninguém por aqui ainda. Crie a primeira sala e chame o pessoal.
                  </p>
                </div>
              )
            ) : (
              <ul className="room-list flex flex-col divide-y divide-[var(--line)]">
                {visiveis.map(({ room }) => (
                  <li key={room.code} className="flex items-center gap-1">
                    <Link
                      href={`/rooms/${room.code}`}
                      className={cx(
                        "flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-3 py-3 transition-colors duration-150 hover:bg-[var(--parchment-edge)]/40",
                        "reticle",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body font-medium text-[var(--parchment-ink)]">
                          {room.name || "Sala sem nome"}
                        </span>
                        <span className="truncate text-caption text-[var(--parchment-ink)]">
                          <span className="font-mono">{room.code.toUpperCase()}</span>
                          {room.videoSource ? ` · ${SOURCE_LABEL[room.videoSource]}` : ""}
                          <span className="sm:hidden"> · {formatWhen(room.updatedAt)}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-caption text-[var(--parchment-ink)] max-sm:hidden">
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
            <nav aria-label="Páginas de salas" className="flex items-center justify-between gap-2">
              {pagina > 1 ? (
                <ButtonLink href={`/rooms?pagina=${pagina - 1}`} variant="outline" size="sm">
                  ← Anteriores
                </ButtonLink>
              ) : (
                <span />
              )}
              <span className="text-caption text-[var(--ink-muted)]">Página {pagina}</span>
              {temProxima ? (
                <ButtonLink href={`/rooms?pagina=${pagina + 1}`} variant="outline" size="sm">
                  Mais →
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
