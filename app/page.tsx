import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Página pública do rockncine.
//
// Antes a raiz era um redirect puro: quem recebia um link de convite caía no
// `/login` sem nenhuma explicação do produto, e o `<meta name="description">`
// do layout raiz — que descreve exatamente isto — nunca era visto por ninguém.
// Link de convite é o funil inteiro do produto (o `InviteCode` copia a URL
// pra mandar no WhatsApp), e ele chegava a uma tela de login sem contexto.
//
// Acessível sem conta, e sem `metadataBase`/imagem: o que o preview de link
// mostra é o título e a descrição, e ambos estão aqui.
export default async function Home() {
  const session = await getServerSession(authOptions);
  // Quem já está dentro vai direto pro menu — a página pública não tem nada
  // a oferecer para quem já tem conta.
  if (session?.user) redirect("/rooms");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-6 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          rockncine
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          assista junto, em sync — cole um link, todo mundo entra na mesma sala e
          o play/pause/seek vai junto.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        {/* Os três passos, e não uma lista de recurso: a pessoa que chegou por
            link de convite quer saber se aquilo funciona, não o que o app tem. */}
        <ol className="flex flex-col gap-3">
          {[
            "crie uma sala e copie o link de convite",
            "cole um link de youtube, vimeo ou mídia direta",
            "todo mundo que abrir o link assiste no mesmo instante",
          ].map((passo, i) => (
            <li key={passo} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ink-muted)] font-mono text-xs text-[var(--ink-muted)]"
              >
                {i + 1}
              </span>
              <span className="text-sm text-[var(--ink)]">{passo}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        <Link
          href="/register"
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          criar conta
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          já tenho conta
        </Link>
      </footer>
    </main>
  );
}
