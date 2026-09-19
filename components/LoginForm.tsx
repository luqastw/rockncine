"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
          const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (res?.error) {
            setError("email ou senha inválidos.");
            return;
          }
          router.push("/rooms");
          router.refresh();
        } catch {
          // Sem isto, uma falha de rede (o fetch do next-auth rejeitando)
          // pulava o `setLoading(false)` e deixava o botão desabilitado em
          // "entrando..." para sempre, sem nenhuma mensagem — a promise
          // rejeitada também virava unhandled rejection.
          setError("não foi possível entrar. verifique sua conexão e tente de novo.");
        } finally {
          setLoading(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        senha
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        {loading ? "entrando..." : "entrar"}
      </button>
    </form>
  );
}
