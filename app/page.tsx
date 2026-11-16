import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

const PASSOS = [
  { titulo: "Crie uma sala", apoio: "Um clique e a sala está pronta, com um link só seu." },
  { titulo: "Cole um link", apoio: "YouTube, Vimeo ou mídia direta. O player carrega para todos." },
  { titulo: "Chame a turma", apoio: "Quem abrir o link entra na hora e assiste no mesmo instante." },
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
            Entrar
          </ButtonLink>
          <ButtonLink href="/register" variant="outline" size="sm">
            Criar conta
          </ButtonLink>
        </nav>
      </header>

      <Reveal
        as="section"
        className="mx-auto flex w-full max-w-[40rem] flex-col items-center gap-8 text-center"
      >
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">
          Assista junto, no mesmo instante
        </h1>
        <p className="text-body text-[var(--ink-muted)]">
          Cole um link, todo mundo entra na mesma sala e o play, o pause e o seek vão junto.
          Chat ao vivo, presença e o mesmo instante para todos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/register" variant="primary">
            Começar agora
          </ButtonLink>
          <ButtonLink href="/login" variant="outline">
            Já tenho conta
          </ButtonLink>
        </div>
        <Staff notes={5} className="mx-auto h-auto w-48 sm:w-60" />
      </Reveal>

      <Reveal as="section" className="mx-auto flex w-full max-w-[40rem] flex-col gap-8">
        <h2 className="text-center font-display text-title font-semibold tracking-tight text-[var(--ink)]">
          Como funciona
        </h2>
        <ol className="flex flex-col gap-4">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="frame flex items-start gap-5 p-5">
              <span
                aria-hidden="true"
                className="font-display text-title font-semibold text-[var(--ink)]"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-body font-medium text-[var(--ink)]">{passo.titulo}</h3>
                <p className="text-body-sm text-[var(--ink-muted)]">{passo.apoio}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      <footer className="text-center text-body-sm text-[var(--ink-muted)]">
        Rockncine · Feito para assistir junto
      </footer>
    </PageShell>
  );
}
