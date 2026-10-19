import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "criar conta · rockncine" };

export default function RegisterPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-2">
        <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">criar conta</h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          assista junto, em sync — link colado, sala compartilhada.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-6">
        <Card className="p-6 sm:p-8">
          <RegisterForm />
        </Card>

        <p className="text-center text-body-sm text-[var(--ink-muted)]">
          já tem conta?{" "}
          <Link
            href="/login"
            className="rounded-sm text-[var(--ink)] underline decoration-[var(--ink-muted)] underline-offset-4 hover:decoration-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            entrar
          </Link>
        </p>
      </Reveal>
    </PageShell>
  );
}
