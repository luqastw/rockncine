import type { Metadata } from "next";
import { RegisterForm } from "@/components/RegisterForm";
import { AuthLayout } from "@/components/chrome/AuthLayout";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";

export const metadata: Metadata = { title: "Criar conta · Rockncine" };

export default function RegisterPage() {
  return (
    <PageShell width="full">
      <AuthLayout
        tagline="Cole um link e chame a turma"
        support="Uma conta, uma sala e o mesmo instante para todo mundo. Leva menos de um minuto."
      >
        <Reveal as="header" className="flex flex-col gap-2">
          <h1 className="text-[clamp(2rem,1.5rem+1.6vw,2.75rem)] leading-tight font-semibold tracking-tight text-gold">
            Criar conta
          </h1>
          <p className="text-body text-[var(--ink-muted)]">
            Leva um minuto. Depois é só colar o link e chamar o pessoal.
          </p>
        </Reveal>

        <Reveal index={1} className="flex flex-col gap-5">
          <Card className="frame-lg p-7 sm:p-9">
            <RegisterForm />
          </Card>

          <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-body text-[var(--ink-muted)]">
            Já tem conta?
            <TextLink href="/login" className="px-1">
              Entrar
            </TextLink>
          </p>
        </Reveal>
      </AuthLayout>
    </PageShell>
  );
}
