import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { DeleteRoomButton } from "@/components/DeleteRoomButton";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Fairy } from "@/components/chrome/Fairy";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon, PlusIcon } from "@/components/room/player/icons";
import { Card } from "@/components/ui/Card";
import { SOURCE_LABEL } from "@/lib/video-source";

export const metadata: Metadata = { title: "Suas salas · Rockncine" };

const PAGE_SIZE = 20;

const TINTS = ["217 164 65", "95 158 79", "191 230 255", "224 122 110"];

function hashCode(code: string) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 16777619);
  return h >>> 0;
}

function coverStyle(code: string): CSSProperties {
  const h = hashCode(code);
  const a = TINTS[h % TINTS.length];
  const b = TINTS[(h >>> 3) % TINTS.length];
  const ax = 10 + (h % 70);
  const ay = 10 + ((h >>> 5) % 60);
  const bx = 100 - ax;
  const by = 100 - ay;
  return {
    backgroundImage: `radial-gradient(60% 90% at ${ax}% ${ay}%, rgb(${a} / 0.42), transparent 70%), radial-gradient(55% 80% at ${bx}% ${by}%, rgb(${b} / 0.26), transparent 70%)`,
  };
}

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
    <PageShell width="lg" nav="app" current="rooms" fog className="gap-10 lg:gap-12">
      <Reveal
        as="header"
        className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-h2 font-semibold break-words text-gold">Olá, {nome}</h1>
          <p className="text-body text-[var(--ink-muted)]">
            Entre numa sala pelo código ou crie uma nova.
          </p>
        </div>
        <ButtonLink href="#room-name" variant="primary" size="lg" className="shrink-0 self-start">
          <PlusIcon className="size-5" />
          Nova sala
        </ButtonLink>
      </Reveal>

      <Reveal index={1}>
        <Card className="frame-lg grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:gap-12">
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-body font-semibold text-[var(--ink)]">Entrar por código</h2>
            <JoinRoomForm />
          </section>
          <section className="flex min-w-0 flex-col gap-3 border-t border-[var(--gold-edge)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
            <h2 className="text-body font-semibold text-[var(--ink)]">Criar sala</h2>
            <CreateRoomForm />
          </section>
        </Card>
      </Reveal>

      <Reveal as="section" index={2} className="flex min-w-0 flex-col gap-6">
        <h2 className="text-card font-semibold text-[var(--ink)]">Suas salas</h2>
        {visiveis.length === 0 ? (
          pagina > 1 ? (
            <p className="text-body text-[var(--ink-muted)]">Não há mais salas nesta página.</p>
          ) : (
            <div
              data-testid="rooms-empty"
              className="frame frame-lg flex flex-col items-center gap-4 px-6 py-14 text-center"
            >
              <Fairy className="size-20" />
              <p className="max-w-sm text-body text-[var(--ink-muted)]">
                Ninguém por aqui ainda. Crie a primeira sala e chame o pessoal.
              </p>
              <ButtonLink href="#room-name" variant="outline">
                Criar a primeira sala
              </ButtonLink>
            </div>
          )
        ) : (
          <ul className="room-list grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map(({ room }, index) => (
              <li
                key={room.code}
                className="relative"
                style={{ "--i": index } as CSSProperties}
              >
                <Link
                  href={`/rooms/${room.code}`}
                  className="frame frame-hover reticle group flex h-full min-h-11 flex-col"
                >
                  <span
                    aria-hidden="true"
                    style={coverStyle(room.code)}
                    className="band relative flex h-28 items-end overflow-hidden px-5 pb-3"
                  >
                    <span className="font-display text-[3.25rem] leading-none font-semibold text-gold opacity-90">
                      {room.code.slice(0, 2).toUpperCase()}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2 p-5">
                    <span className="truncate font-display text-card font-semibold text-[var(--ink)]">
                      {room.name || "Sala sem nome"}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-caption text-[var(--ink-muted)]">
                      <span className="font-mono tracking-wider text-[var(--ink)]">
                        {room.code.toUpperCase()}
                      </span>
                      {room.videoSource ? <span>· {SOURCE_LABEL[room.videoSource]}</span> : null}
                      <span>· {formatWhen(room.updatedAt)}</span>
                    </span>
                  </span>
                  <ArrowRightIcon className="absolute right-5 bottom-5 size-5 text-[var(--gold)] transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                {room.ownerId === userId && (
                  <DeleteRoomButton
                    roomCode={room.code}
                    roomName={room.name}
                    className="absolute top-3 right-3 z-10 bg-[var(--bg-void)]/80"
                  />
                )}
              </li>
            ))}
          </ul>
        )}

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
    </PageShell>
  );
}
