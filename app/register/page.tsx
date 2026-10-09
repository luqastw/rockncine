import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";

export const metadata: Metadata = { title: "criar conta · rockncine" };

export default function RegisterPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
          rockncine
        </h1>
        {/* mesma promessa da tela de entrar — ver comentário em app/login/page.tsx */}
        <p className="text-sm text-[var(--ink-muted)]">
          assista junto, em sync — link colado, sala compartilhada.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-8">
        <RegisterForm />

        <p className="text-sm text-[var(--ink-muted)]">
          já tem conta?{" "}
          <Link
            href="/login"
            className="rounded-sm text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            entrar
          </Link>
        </p>
      </Reveal>
    </PageShell>
  );
}
