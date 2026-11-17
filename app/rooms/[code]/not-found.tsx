import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export default function RoomNotFound() {
  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Card className="frame-lg flex flex-col items-center gap-6 p-8">
        <Staff notes={3} className="mx-auto h-auto w-32" />
        <h1 className="text-card font-semibold text-[var(--ink)]">
          Sala não encontrada
        </h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          Esse código não corresponde a nenhuma sala ativa. Confira se digitou certo.
        </p>
        <ButtonLink href="/rooms" variant="primary">
          Voltar pro menu
        </ButtonLink>
      </Card>
    </PageShell>
  );
}
