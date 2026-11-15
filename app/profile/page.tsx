import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { ProfileAvatarForm } from "@/components/ProfileAvatarForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sectionLabelClass } from "@/components/ui/SectionLabel";

export const metadata: Metadata = { title: "perfil · rockncine" };

export default async function ProfilePage() {
  const { userId, userName } = await requireSession();
  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { updatedAt: true },
  });
  const avatarV = image ? image.updatedAt.getTime() : null;

  return (
    <PageShell width="md" chrome className="justify-safe-center gap-10">
      <Reveal as="header" className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={sectionLabelClass}>seu perfil</span>
          <h1 className="truncate text-heading font-semibold tracking-tight text-[var(--ink)]">
            {userName}
          </h1>
        </div>
        <ButtonLink href="/rooms" variant="outline" size="sm" className="shrink-0">
          voltar para suas salas
        </ButtonLink>
      </Reveal>

      <Reveal as="section">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className={sectionLabelClass}>imagem de perfil</h2>
          <ProfileAvatarForm userId={userId} initialAvatarV={avatarV} />
        </Card>
      </Reveal>
    </PageShell>
  );
}
