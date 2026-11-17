"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CloseIcon, MenuIcon } from "@/components/room/player/icons";
import { Silhouette } from "./Pattern";
import { Wordmark } from "./Wordmark";

export type NavKey = "rooms" | "profile";

const ITEMS: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: "rooms", href: "/rooms", label: "Salas" },
  { key: "profile", href: "/profile", label: "Perfil" },
];

const MENU_ID = "site-menu";

const itemClass =
  "group flex min-h-11 w-full items-center gap-4 rounded-sm text-left font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-tight font-semibold text-[var(--ink)] transition-colors duration-300 hover:text-[var(--gold-hi)] reticle";

function Marker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-[1ch] shrink-0 text-[0.55em] text-[var(--gold)] transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
      }`}
    >
      ▷
    </span>
  );
}

export function SiteNav({ current }: { current?: NavKey }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const openFrom = (element: HTMLElement) => {
    triggerRef.current = element;
    setOpen(true);
  };

  const closeAndRestore = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const trigger = (extra: string) => (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={MENU_ID}
      aria-haspopup="dialog"
      onClick={(event) => openFrom(event.currentTarget)}
      className={`${extra} reticle`}
    >
      <MenuIcon className="size-6" />
      <span className="text-caption font-medium tracking-wide text-[var(--ink)]">Menu</span>
    </button>
  );

  return (
    <>
      <aside
        aria-label="Navegação principal"
        className="rail fixed inset-y-0 left-0 z-40 hidden w-[var(--rail)] flex-col items-center justify-between py-5 lg:flex"
      >
        <Link
          href="/rooms"
          aria-label="Rockncine, suas salas"
          className="inline-flex size-11 min-h-11 items-center justify-center rounded-sm reticle"
        >
          <Wordmark markOnly />
        </Link>
        {trigger(
          "flex h-32 min-h-11 w-11 flex-col items-center justify-center gap-3 rounded-sm text-[var(--gold-hi)] transition-colors duration-300 hover:bg-[var(--fill-1)] [&>span]:[writing-mode:vertical-rl]",
        )}
        <span aria-hidden="true" className="size-2 rotate-45 bg-[var(--gold)]" />
      </aside>

      <header className="chrome-blur fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden">
        <Link href="/rooms" className="inline-flex min-h-11 items-center rounded-sm reticle">
          <Wordmark />
        </Link>
        {trigger(
          "flex min-h-11 items-center gap-2 rounded-sm px-3 text-[var(--gold-hi)] hover:bg-[var(--fill-1)]",
        )}
      </header>

      <div
        id={MENU_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-open={open ? "true" : "false"}
        inert={!open}
        className="menu-overlay"
      >
        <div
          ref={panelRef}
          className="relative mx-auto flex h-full w-full max-w-7xl flex-col px-6 py-5 sm:px-10 lg:pl-[calc(var(--rail)+2.5rem)]"
        >
          <div className="flex items-center justify-between">
            <div className="menu-emblem">
              <Wordmark />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={closeAndRestore}
              aria-label="Fechar menu"
              className="menu-emblem inline-flex min-h-11 items-center gap-2 rounded-sm px-3 text-[var(--ink)] hover:text-[var(--gold-hi)] reticle"
            >
              <span className="text-caption font-medium tracking-wide">Fechar</span>
              <CloseIcon className="size-5" />
            </button>
          </div>

          <nav aria-label="Menu" className="flex flex-1 flex-col justify-center">
            <ul className="flex flex-col gap-2">
              {ITEMS.map((item, index) => (
                <li
                  key={item.key}
                  className="menu-item"
                  style={{ "--i": index } as CSSProperties}
                >
                  <Link
                    href={item.href}
                    aria-current={current === item.key ? "page" : undefined}
                    onClick={close}
                    className={itemClass}
                  >
                    <Marker active={current === item.key} />
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="menu-item" style={{ "--i": ITEMS.length } as CSSProperties}>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className={itemClass}
                >
                  <Marker active={false} />
                  Sair
                </button>
              </li>
            </ul>
          </nav>

          <div
            aria-hidden="true"
            className="menu-art pointer-events-none absolute top-1/2 right-0 hidden w-[44vw] max-w-[640px] -translate-y-1/2 lg:block"
          >
            <Silhouette className="h-auto w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
