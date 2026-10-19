import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { ButtonLink } from "@/components/ui/Button";

// Página pública do rockncine. Link de convite é o funil inteiro do produto:
// quem chega precisa entender o que é antes de criar conta.
//
// A composição segue a hero da Kimi Platform (spec 15,
// docs/specs/15-identidade-kimi/spec.md): eyebrow em pill, wordmark em
// gradiente prateado, preview decorativo e três passos em cards. A marca vive
// no h1 e os três passos continuam sendo exatamente três (AC-011 da spec 14).
export default async function Home() {
  const session = await getServerSession(authOptions);
  // Quem já está dentro vai direto pro menu — a página pública não tem nada
  // a oferecer para quem já tem conta.
  if (session?.user) redirect("/rooms");

  return (
    <PageShell width="lg" chrome className="justify-safe-center gap-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <Reveal as="header" className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--fill-1)] px-3 py-2 font-mono text-caption text-[var(--ink-muted)]">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--ink)]" />
            assista junto, em sync
          </span>

          <h1 className="bg-gradient-to-r from-[#b3b3b3] via-white to-[#8f8f8f] bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
            rockncine
          </h1>

          <p className="max-w-lg text-body text-[var(--ink-muted)]">
            cole um link, todo mundo entra na mesma sala e o play, o pause e o seek vão junto.
            chat ao vivo, presença e o mesmo instante para todos.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/register" variant="primary">
              criar conta
            </ButtonLink>
            <ButtonLink href="/login" variant="outline">
              já tenho conta
            </ButtonLink>
          </div>
        </Reveal>

        {/* Preview decorativo: nenhum controle real, nenhum link. A área é
            `aria-hidden` para o leitor de tela não anunciar uma sala falsa. */}
        <Reveal as="div" className="relative">
          <div
            aria-hidden="true"
            className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_62%)]" />
            <div className="relative flex aspect-video items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)] shadow-[var(--shadow-pop)]">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-1 h-6 w-6">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
            <span className="absolute left-4 top-4 rounded-full bg-[var(--bg-void)]/80 px-2.5 py-1 font-mono text-micro text-[var(--ink-muted)]">
              sala · 8F3K2M
            </span>
            <span className="absolute bottom-4 left-4 rounded-full bg-[var(--bg-void)]/80 px-2.5 py-1 text-micro text-[var(--ink-muted)]">
              2 na sala
            </span>
            <span className="absolute bottom-4 right-4 max-w-[45%] rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-body-sm text-[var(--ink)]">
              sincronizado
            </span>
          </div>
        </Reveal>
      </div>

      <Reveal as="section" className="flex flex-col gap-4">
        <p className="font-mono text-caption uppercase tracking-wide text-[var(--ink-muted)]">
          como funciona
        </p>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            "crie uma sala e copie o link de convite",
            "cole um link de youtube, vimeo ou mídia direta",
            "todo mundo que abrir o link assiste no mesmo instante",
          ].map((passo, i) => (
            <li
              key={passo}
              className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4"
            >
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full border border-[var(--line)] font-mono text-caption text-[var(--ink-muted)]"
              >
                {i + 1}
              </span>
              <span className="text-body-sm text-[var(--ink)]">{passo}</span>
            </li>
          ))}
        </ol>
      </Reveal>
    </PageShell>
  );
}
