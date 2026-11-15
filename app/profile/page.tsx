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
  const { userId } = await requireSession();
  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { updatedAt: true },
  });
  const avatarV = image ? image.updatedAt.getTime() : null;

  return (
    <PageShell width="sm" chrome fog className="justify-safe-center gap-8">
      <Reveal as="header" className="flex flex-col items-center gap-4 text-center">
        <ButtonLink href="/rooms" variant="outline" size="sm" className="self-start">
          voltar para suas salas
        </ButtonLink>
        <h1 className="font-display text-heading font-semibold tracking-tight text-[var(--ink)]">
          seu perfil
        </h1>
      </Reveal>

      <Reveal as="section">
        <Card className="flex flex-col gap-5 p-5 sm:p-8">
          <h2 className={sectionLabelClass}>imagem de perfil</h2>
          <ProfileAvatarForm userId={userId} initialAvatarV={avatarV} />
        </Card>
      </Reveal>
    </PageShell>
  );
}
