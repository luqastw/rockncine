"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function ChromeBar({ actions }: { actions?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="chrome-blur fixed inset-x-0 top-0 z-30 flex justify-center"
    >
      <div className="flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-6 sm:px-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          <Wordmark />
        </Link>
        {actions ? <nav className="flex items-center gap-1">{actions}</nav> : null}
      </div>
    </header>
  );
}
