import { PageShell } from "@/components/chrome/PageShell";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

// Estado de 404 com a mesma linguagem do resto (FR-007/FR-008 da spec 15):
// wordmark em gradiente, fio de 1px e tipografia sem serifa. Sem `ChromeBar` —
// os estados compartilham a marca em uma única ocorrência acessível.
export default function NotFound() {
  return (
    <PageShell width="sm" className="items-center justify-center gap-4 text-center">
      <Wordmark />
      <span aria-hidden="true" className="h-px w-16 bg-[var(--hairline)]" />
      <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">
        página não encontrada
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">esse link não existe.</p>
      <ButtonLink href="/" variant="primary">
        voltar
      </ButtonLink>
    </PageShell>
  );
}
