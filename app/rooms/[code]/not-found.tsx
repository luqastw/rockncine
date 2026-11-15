import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export default function RoomNotFound() {
  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Staff notes={3} className="mx-auto h-auto w-32" />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
        sala não encontrada
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">
        esse código não corresponde a nenhuma sala ativa. confira se digitou certo.
      </p>
      <ButtonLink href="/rooms" variant="primary">
        voltar pro menu
      </ButtonLink>
    </PageShell>
  );
}
