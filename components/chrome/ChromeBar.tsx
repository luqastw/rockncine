"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";

// Barra fixa de chrome com a marca (FR-005/FR-007,
// docs/specs/15-identidade-kimi/spec.md). É o único consumidor de `.chrome-blur`
// no chrome: fundo 72%, blur de 6px e fio que aparece depois do primeiro scroll,
// como na navegação da Kimi Platform.
//
// Client component só por causa do listener passivo de scroll que alterna
// `data-scrolled`. Nenhum estado de negócio, nenhum contexto.
export function ChromeBar({ width = "md" }: { width?: "sm" | "md" | "lg" }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const maxWidth =
    width === "lg" ? "max-w-5xl" : width === "md" ? "max-w-3xl" : "max-w-[26rem]";

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="chrome-blur fixed inset-x-0 top-0 z-30 flex justify-center"
    >
      <div className={`flex h-14 w-full items-center px-6 sm:px-10 ${maxWidth}`}>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          <Wordmark />
        </Link>
      </div>
    </header>
  );
}
