import type { Metadata } from "next";
import { RegisterForm } from "@/components/RegisterForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";

export const metadata: Metadata = { title: "criar conta · rockncine" };

export default function RegisterPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-2">
        <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">criar conta</h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          leva um minuto. depois é só colar o link e chamar o pessoal.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-6">
        <Card className="p-6 sm:p-8">
          <RegisterForm />
        </Card>

        <p className="text-center text-body-sm text-[var(--ink-muted)]">
          já tem conta?{" "}
          <TextLink href="/login">entrar</TextLink>
        </p>
      </Reveal>
    </PageShell>
  );
}
