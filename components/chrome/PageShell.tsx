import type { ReactNode } from "react";
import { ChromeBar } from "./ChromeBar";
import { Fog } from "./Fog";
import { SiteNav, type NavKey } from "./SiteNav";

const WIDTHS = {
  sm: "max-w-xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  full: "",
} as const;

export function PageShell({
  children,
  width = "lg",
  nav = "none",
  current,
  actions,
  fog = false,
  className,
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  nav?: "none" | "public" | "app";
  current?: NavKey;
  actions?: ReactNode;
  fog?: boolean;
  className?: string;
}) {
  const topPadding =
    nav === "app" ? "pt-20 lg:pt-14" : nav === "public" ? "pt-24 sm:pt-28" : "pt-10 sm:pt-14";
  const bottomPadding = fog ? "pb-40 sm:pb-44" : "pb-16 sm:pb-20";
  const gutters = width === "full" ? "" : "px-6 sm:px-10";

  return (
    <>
      {nav === "public" ? <ChromeBar actions={actions} /> : null}
      {nav === "app" ? <SiteNav current={current} /> : null}
      <div
        className={`relative flex min-h-dvh w-full flex-col overflow-x-clip ${
          nav === "app" ? "lg:pl-[var(--rail)]" : ""
        }`}
      >
        <main
          className={[
            "relative z-10 mx-auto flex w-full flex-1 flex-col",
            gutters,
            width === "full" ? "" : topPadding,
            width === "full" ? "" : bottomPadding,
            WIDTHS[width],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </main>
        {fog ? <Fog /> : null}
      </div>
    </>
  );
}
