import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { AsciiArt } from "@/components/chrome/AsciiArt";
import { HERO_ART } from "@/components/chrome/ascii";

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
//
// No redesign (spec 14) a página ganha o hero em Display mono com a arte ASCII
// decorativa e o invólucro único `PageShell`; os três passos e os dois CTA
// continuam os mesmos (FR-017, docs/specs/14-identidade-fanzine-crt/spec.md).
export default async function Home() {
  const session = await getServerSession(authOptions);
  // Quem já está dentro vai direto pro menu — a página pública não tem nada
  // a oferecer para quem já tem conta.
  if (session?.user) redirect("/rooms");

  return (
    <PageShell width="md" chrome className="justify-center gap-10">
      <Reveal as="header" className="flex flex-col gap-3">
        {/* Decoração primeiro, marca acessível depois (FR-009): a arte é
            `aria-hidden` e o nome "rockncine" vive no h1. */}
        <AsciiArt art={HERO_ART} />
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
          rockncine
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          assista junto, em sync — cole um link, todo mundo entra na mesma sala e
          o play/pause/seek vai junto.
        </p>
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-4">
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
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ink-muted)] font-display text-xs text-[var(--ink-muted)]"
              >
                {i + 1}
              </span>
              <span className="text-sm text-[var(--ink)]">{passo}</span>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal as="footer" className="flex flex-wrap items-center gap-3">
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
      </Reveal>
    </PageShell>
  );
}
