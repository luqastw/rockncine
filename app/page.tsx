import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AsciiKorok } from "@/components/chrome/AsciiKorok";
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
const GLIFOS = ["[+]", ">>", "=="];

export default async function Home() {
  const session = await getServerSession(authOptions);
  // Quem já está dentro vai direto pro menu — a página pública não tem nada
  // a oferecer para quem já tem conta.
  if (session?.user) redirect("/rooms");

  return (
    <PageShell width="lg" chrome className="justify-safe-center gap-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <Reveal as="header" className="flex flex-col items-start gap-6">
          <div className="flex items-end gap-4">
            <AsciiKorok variant="hero" className="mb-1 sm:mb-2" />
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">
              rockncine
            </h1>
          </div>

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
            <div className="relative flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-3">
                {[
                  { who: "l", text: "pausa aí" },
                  { who: "m", text: "voltei" },
                ].map((msg) => (
                  <div key={msg.text} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--fill-2)] font-mono text-caption font-semibold text-[var(--accent)]">
                      {msg.who}
                    </span>
                    <span className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-body-sm text-[var(--ink)]">
                      {msg.text}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="relative h-1.5 rounded-full bg-[var(--fill-2)]">
                  <span className="absolute inset-y-0 left-0 w-[46%] rounded-full bg-[var(--accent)]/40" />
                  <span className="absolute top-1/2 left-[46%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
                  <span className="absolute top-1/2 left-[46%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)] bg-[var(--bg-void)] scale-150" />
                </div>
                <div className="flex items-center justify-between font-mono text-micro text-[var(--ink-muted)]">
                  <span>l · m</span>
                  <span>no mesmo instante</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal as="section" className="flex flex-col gap-4">
        <p className="text-caption font-medium text-[var(--ink-muted)]">
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
                className="font-mono text-body font-semibold text-[var(--accent)]"
              >
                {GLIFOS[i]}
              </span>
              <span className="text-body-sm text-[var(--ink)]">{passo}</span>
            </li>
          ))}
        </ol>
      </Reveal>
    </PageShell>
  );
}
