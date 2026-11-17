import type { ReactNode } from "react";
import Image from "next/image";
import { Silhouette } from "./Pattern";
import { Wordmark } from "./Wordmark";

export function AuthLayout({
  tagline,
  support,
  children,
}: {
  tagline: string;
  support: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside
        data-motif="auth-art"
        className="band relative flex flex-col justify-between gap-8 overflow-hidden border-b border-[var(--gold-edge)] px-6 py-8 sm:px-10 lg:min-h-dvh lg:border-r lg:border-b-0 lg:px-14 lg:py-12"
      >
        <Silhouette className="pointer-events-none absolute -right-24 top-1/2 hidden size-[46rem] -translate-y-1/2 opacity-70 lg:block" />
        <div className="relative flex items-center justify-between">
          <Wordmark />
          <Image
            src="/brand/fairy.png"
            alt=""
            width={96}
            height={96}
            unoptimized
            aria-hidden="true"
            data-motif="fairy"
            className="size-12 drop-shadow-[0_0_10px_var(--fairy)] lg:hidden"
          />
        </div>
        <div className="relative flex flex-col gap-5 lg:max-w-xl">
          <Image
            src="/brand/fairy.png"
            alt=""
            width={96}
            height={96}
            unoptimized
            aria-hidden="true"
            className="hidden size-20 drop-shadow-[0_0_14px_var(--fairy)] lg:block"
          />
          <p className="font-display text-[clamp(2rem,1.2rem+3.4vw,4.25rem)] leading-[1.04] font-semibold tracking-tight text-gold">
            {tagline}
          </p>
          <p className="hidden max-w-md text-body text-[var(--ink-muted)] sm:block">{support}</p>
        </div>
        <p className="relative hidden text-caption text-[var(--ink-muted)] lg:block">
          Rockncine · Feito para assistir junto
        </p>
      </aside>
      <div className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:py-16">
        <div className="flex w-full max-w-md flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
