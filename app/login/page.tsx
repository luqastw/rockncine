import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { AuthLayout } from "@/components/chrome/AuthLayout";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";

export const metadata: Metadata = { title: "Entrar · Rockncine" };

export default function LoginPage() {
  return (
    <PageShell width="full">
      <AuthLayout
        tagline="A sala continua do jeito que você deixou"
        support="Entre para voltar às suas salas, ao chat e ao vídeo exatamente de onde pararam."
      >
        <Reveal as="header" className="flex flex-col gap-2">
          <h1 className="text-[clamp(2rem,1.5rem+1.6vw,2.75rem)] leading-tight font-semibold tracking-tight text-gold">
            Entrar
          </h1>
          <p className="text-body text-[var(--ink-muted)]">
            Bem-vindo de volta. Use o email e a senha da sua conta.
          </p>
        </Reveal>

        <Reveal index={1} className="flex flex-col gap-5">
          <Card className="frame-lg p-7 sm:p-9">
            <LoginForm />
          </Card>

          <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-body text-[var(--ink-muted)]">
            Sem conta?
            <TextLink href="/register" className="px-1">
              Cadastrar
            </TextLink>
          </p>
        </Reveal>
      </AuthLayout>
    </PageShell>
  );
}
