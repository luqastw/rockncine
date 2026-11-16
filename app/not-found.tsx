import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/chrome/PageShell";
import { Fairy } from "@/components/chrome/Fairy";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Card className="flex flex-col items-center gap-6 p-6">
        <Fairy className="mx-auto size-20" />
        <h1 className="font-display text-title font-semibold tracking-tight text-[var(--ink)]">
          Você voltou ao mesmo lugar
        </h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          As árvores parecem as mesmas. A trilha certa começa do início.
        </p>
        <ButtonLink href="/" variant="primary">
          Voltar ao começo
        </ButtonLink>
      </Card>
    </PageShell>
  );
}
