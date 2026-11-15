import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

const PASSOS = [
  { titulo: "crie uma sala", apoio: "um clique e a sala está pronta, com um link só seu." },
  { titulo: "cole um link", apoio: "youtube, vimeo ou mídia direta. o player carrega para todos." },
  { titulo: "chame a turma", apoio: "quem abrir o link entra na hora e assiste no mesmo instante." },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/rooms");

  return (
    <PageShell width="lg" fog className="gap-20 sm:gap-28">
      <header className="flex items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            entrar
          </ButtonLink>
          <ButtonLink href="/register" variant="outline" size="sm">
            criar conta
          </ButtonLink>
        </nav>
      </header>

      <Reveal
        as="section"
        className="mx-auto flex w-full max-w-[40rem] flex-col items-center gap-8 text-center"
      >
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">
          assista junto, no mesmo instante
        </h1>
        <p className="text-body text-[var(--ink-muted)]">
          cole um link, todo mundo entra na mesma sala e o play, o pause e o seek vão junto.
          chat ao vivo, presença e o mesmo instante para todos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/register" variant="primary">
            começar agora
          </ButtonLink>
          <ButtonLink href="/login" variant="outline">
            já tenho conta
          </ButtonLink>
        </div>
        <Staff notes={5} className="mx-auto h-auto w-48 sm:w-60" />
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-12">
        <h2 className="text-center font-display text-title font-semibold tracking-tight text-[var(--ink)]">
          como funciona
        </h2>
        <div className="relative">
          <div
            aria-hidden="true"
            data-staff-rule=""
            className="pointer-events-none absolute inset-x-[16%] top-[14px] hidden flex-col gap-[7px] opacity-60 lg:flex"
          >
            {[0, 1, 2, 3, 4].map((linha) => (
              <span key={linha} className="h-px bg-[var(--line-strong)]" />
            ))}
          </div>
          <ol className="relative flex flex-col gap-10 lg:flex-row lg:gap-12">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="flex flex-1 flex-col gap-3 text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto bg-[var(--bg-void)] px-4 font-display text-title font-semibold text-[var(--torch)]"
                >
                  {i + 1}
                </span>
                <h3 className="text-body font-medium text-[var(--ink)]">{passo.titulo}</h3>
                <p className="text-body-sm text-[var(--ink-muted)]">{passo.apoio}</p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <footer className="text-center text-body-sm text-[var(--ink-muted)]">
        rockncine · feito para assistir junto
      </footer>
    </PageShell>
  );
}
