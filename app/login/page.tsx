import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";

export const metadata: Metadata = { title: "entrar · rockncine" };

export default function LoginPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-2">
        <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">entrar</h1>
        <p className="text-body-sm text-[var(--ink-muted)]">
          bem-vindo de volta. a sala continua do jeito que você deixou.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-6">
        <Card className="p-6 sm:p-8">
          <LoginForm />
        </Card>

        <p className="text-center text-body-sm text-[var(--ink-muted)]">
          sem conta?{" "}
          <TextLink href="/register">cadastrar</TextLink>
        </p>
      </Reveal>
    </PageShell>
  );
}
