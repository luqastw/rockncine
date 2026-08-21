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
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        setLoading(false);
        if (res?.error) {
          setError("Email ou senha inválidos.");
          return;
        }
        router.push("/rooms");
        router.refresh();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        senha
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
        />
      </label>
      {error && (
        <p className="rounded-md border-2 border-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        {loading ? "entrando..." : "entrar"}
      </button>
    </form>
  );
}
