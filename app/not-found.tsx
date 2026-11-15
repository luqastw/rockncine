import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Staff notes={3} className="mx-auto h-auto w-32" />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
        você voltou ao mesmo lugar
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">
        as árvores parecem as mesmas. a trilha certa começa do início.
      </p>
      <ButtonLink href="/" variant="primary">
        voltar ao começo
      </ButtonLink>
    </PageShell>
  );
}
