import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl text-[var(--ink)]">rockncine</h1>
        <p className="text-sm text-[var(--ink-muted)]">criar conta</p>
      </header>

      <RegisterForm />

      <p className="text-sm text-[var(--ink-muted)]">
        já tem conta?{" "}
        <Link
          href="/login"
          className="rounded-sm text-[var(--ember)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        >
          entrar
        </Link>
      </p>
    </main>
  );
}
