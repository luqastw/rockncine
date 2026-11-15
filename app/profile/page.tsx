import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { ProfileAvatarForm } from "@/components/ProfileAvatarForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "perfil · rockncine" };

export default async function ProfilePage() {
  const { userId, userName } = await requireSession();
  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { updatedAt: true },
  });
  const avatarV = image ? image.updatedAt.getTime() : null;

  return (
    <PageShell
      width="sm"
      chrome
      fog
      className="gap-8"
      actions={
        <ButtonLink href="/rooms" variant="ghost" size="sm">
          ← suas salas
        </ButtonLink>
      }
    >
      <Reveal as="header" className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-title font-semibold tracking-tight text-[var(--ink)]">
          seu perfil
        </h1>
        <p className="text-body text-[var(--ink-muted)]">{userName}</p>
      </Reveal>

      <Reveal as="section">
        <Card className="p-6 sm:p-8">
          <ProfileAvatarForm userId={userId} initialAvatarV={avatarV} />
        </Card>
      </Reveal>
    </PageShell>
  );
}
