import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";

// Sem metadata por rota, todas as páginas herdavam o mesmo `<title>rockncine</title>`
// do layout raiz — abas e histórico ficavam indistinguíveis.
export const metadata: Metadata = { title: "entrar · rockncine" };

export default function LoginPage() {
  return (
    <PageShell width="sm" chrome className="justify-center gap-8">
      <Reveal as="header" className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
          rockncine
        </h1>
        {/* A chegada só dizia "entrar na conta": quem nunca viu o produto não
            descobria o que ele faz em lugar nenhum antes de criar conta (achado
            9 da revisão de design). A promessa é a mesma do `<meta
            name="description">`; o rótulo da ação continua no botão e no
            título da aba. */}
        <p className="text-sm text-[var(--ink-muted)]">
          assista junto, em sync — link colado, sala compartilhada.
        </p>
      </Reveal>

      <Reveal className="flex flex-col gap-8">
        <LoginForm />

        <p className="text-sm text-[var(--ink-muted)]">
          sem conta?{" "}
          <Link
            href="/register"
            className="rounded-sm text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            cadastrar
          </Link>
        </p>
      </Reveal>
    </PageShell>
  );
}
