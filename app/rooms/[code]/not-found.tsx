import { PageShell } from "@/components/chrome/PageShell";
import { ButtonLink } from "@/components/ui/Button";

export default function RoomNotFound() {
  return (
    <PageShell width="sm" className="items-center justify-center gap-4 text-center">
      <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">
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
