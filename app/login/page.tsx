import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "entrar · rockncine" };

export default function LoginPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-2">
        <Wordmark className="mb-2" />
        <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">entrar</h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          assista junto, em sync — link colado, sala compartilhada.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-6">
        <Card className="p-6 sm:p-8">
          <LoginForm />
        </Card>

        <p className="text-center text-body-sm text-[var(--ink-muted)]">
          sem conta?{" "}
          <Link
            href="/register"
            className="rounded-sm text-[var(--ink)] underline decoration-[var(--ink-muted)] underline-offset-4 hover:decoration-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            cadastrar
          </Link>
        </p>
      </Reveal>
    </PageShell>
  );
}
