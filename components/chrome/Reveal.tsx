"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Elementos aceitos pelo invólucro — todos host, para o `ref` continuar seguro. */
type RevealTag = "div" | "section" | "header" | "footer";

// Realce progressivo (FR-013/FR-014, docs/specs/14-identidade-fanzine-crt/spec.md).
// É o ÚNICO client component de components/chrome/**.
//
// O efeito existe só para setar `data-visible`; quem esconde e revela é o CSS, e
// ele só esconde quando o marcador `[data-js]` está presente. Sem JavaScript o
// atributo não existe, `.reveal` não casa seletor nenhum e o conteúdo nasce
// visível (AC-001). Sem `IntersectionObserver`, marca visível na hora (AC-002) —
// a animação é sempre aprimoramento, nunca portão.
export function Reveal({
  as = "div",
  children,
  className,
}: {
  as?: RevealTag;
  children: ReactNode;
  className?: string;
}) {
  // Tipado como div (o alvo default). Os outros host elements aceitam este ref
  // porque o tipo deles é o mais largo (`HTMLElement`); o efeito só usa
  // `setAttribute` e `IntersectionObserver`, nada específico de div.
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Prova de hidratação para a rede de segurança do layout: qualquer Reveal
    // montado sinaliza que o bundle carregou, e o fallback por timeout de
    // FR-014 deixa de revelar tudo à força.
    document.documentElement.setAttribute("data-hydrated", "");

    const node = ref.current;
    if (!node || node.hasAttribute("data-visible")) return;

    if (typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-visible", "");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          node.setAttribute("data-visible", "");
          observer.disconnect();
          return;
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", className].filter(Boolean).join(" ");

  switch (as) {
    case "section":
      return (
        <section ref={ref} className={classes}>
          {children}
        </section>
      );
    case "header":
      return (
        <header ref={ref} className={classes}>
          {children}
        </header>
      );
    case "footer":
      return (
        <footer ref={ref} className={classes}>
          {children}
        </footer>
      );
    default:
      return (
        <div ref={ref} className={classes}>
          {children}
        </div>
      );
  }
}
