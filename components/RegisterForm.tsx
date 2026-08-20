"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
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

        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Não foi possível cadastrar.");
          setLoading(false);
          return;
        }

        const signInRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        setLoading(false);
        if (signInRes?.error) {
          router.push("/login");
          return;
        }
        router.push("/rooms");
        router.refresh();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        nome (opcional)
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ink-muted)]">
        senha (mín. 8 caracteres)
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        />
      </label>
      {error && <p className="text-sm text-[var(--ember)]">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 rounded-md bg-[var(--ember)] px-4 py-2 text-sm font-medium text-[var(--bg-void)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        {loading ? "criando..." : "criar conta"}
      </button>
    </form>
  );
}
