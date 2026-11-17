import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/chrome/PageShell";
import { Fairy } from "@/components/chrome/Fairy";
import { Silhouette } from "@/components/chrome/Pattern";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ArrowRightIcon } from "@/components/room/player/icons";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell width="lg" fog className="gap-12 lg:justify-center">
      <Wordmark />
      <Card className="frame-lg grid items-center gap-12 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:p-16">
        <div className="flex flex-col items-start gap-7">
          <p className="font-mono text-caption tracking-widest text-[var(--gold-hi)]">Erro 404</p>
          <h1 className="text-display font-semibold text-gold">Você voltou ao mesmo lugar</h1>
          <p className="max-w-lg text-body text-[var(--ink-muted)] sm:text-lg">
            As árvores parecem as mesmas. A trilha certa começa do início.
          </p>
          <ButtonLink href="/" variant="primary" size="lg">
            Voltar ao começo
            <ArrowRightIcon className="size-5" />
          </ButtonLink>
        </div>
        <div className="relative mx-auto hidden w-full max-w-md items-center justify-center lg:flex">
          <Silhouette className="w-full" />
          <Fairy className="absolute size-24" />
        </div>
        <div className="flex justify-start lg:hidden">
          <Fairy className="size-20" />
        </div>
      </Card>
    </PageShell>
  );
}
