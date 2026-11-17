import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { ProfileAvatarForm } from "@/components/ProfileAvatarForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon } from "@/components/room/player/icons";

export const metadata: Metadata = { title: "Perfil · Rockncine" };

export default async function ProfilePage() {
  const { userId, userName } = await requireSession();
  const [image, account, owned, joined] = await Promise.all([
    prisma.profileImage.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
    prisma.room.count({ where: { ownerId: userId } }),
    prisma.roomMember.count({ where: { userId } }),
  ]);
  const avatarV = image ? image.updatedAt.getTime() : null;
  const since = account?.createdAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const details = [
    { label: "Nome", value: userName },
    { label: "Email", value: account?.email ?? "Não informado" },
    { label: "Membro desde", value: since ?? "Não informado" },
  ];

  return (
    <PageShell width="lg" nav="app" current="profile" fog className="gap-10 lg:gap-14">
      <Reveal as="header" className="flex flex-col gap-3">
        <h1 className="text-h2 font-semibold text-gold">Seu perfil</h1>
        <p className="max-w-xl text-body text-[var(--ink-muted)]">
          Sua foto aparece no chat e na lista de presença das salas.
        </p>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <Reveal as="section" index={0}>
          <Card className="frame-lg p-7 sm:p-10">
            <ProfileAvatarForm userId={userId} initialAvatarV={avatarV} />
          </Card>
        </Reveal>

        <Reveal as="section" index={1} className="flex flex-col gap-8">
          <Card className="frame-lg flex flex-col gap-6 p-7 sm:p-10">
            <h2 className="border-b border-[var(--gold-edge)] pb-3 text-card font-semibold text-[var(--ink)]">
              Sua conta
            </h2>
            <dl className="flex flex-col gap-5">
              {details.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-caption text-[var(--ink-muted)]">{label}</dt>
                  <dd className="break-words text-body text-[var(--ink)]">{value}</dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-2 gap-4 border-t border-[var(--gold-edge)] pt-6">
              <div className="flex flex-col gap-1">
                <dt className="text-caption text-[var(--ink-muted)]">Salas criadas</dt>
                <dd className="font-display text-card font-semibold text-gold">{owned}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-caption text-[var(--ink-muted)]">Salas que frequenta</dt>
                <dd className="font-display text-card font-semibold text-gold">{joined}</dd>
              </div>
            </dl>
          </Card>
          <ButtonLink href="/rooms" variant="outline" size="lg" className="self-start">
            Ir para suas salas
            <ArrowRightIcon className="size-5" />
          </ButtonLink>
        </Reveal>
      </div>
    </PageShell>
  );
}
