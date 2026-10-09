import type { ReactNode } from "react";
import { ChromeBar } from "./ChromeBar";
import { GrainOverlay } from "./GrainOverlay";

// Invólucro único de página (FR-018, docs/specs/14-identidade-fanzine-crt/spec.md):
// largura, padding e grão vivem só aqui, no lugar das mesmas classes de `main`
// repetidas em cada tela. O grão NÃO fica no layout raiz — ele é ancestral da
// sala, e textura ali quebraria AC-017 (D-004).
//
// Sem "use client" e sem API de servidor: precisa poder ser importado por páginas
// server (`/`, `/rooms`, 404) e pelos boundaries client (`error.tsx`).
export function PageShell({
  children,
  width = "sm",
  chrome = false,
  className,
}: {
  children: ReactNode;
  /** Largura da coluna: `sm` (auth/estados) ou `md` (landing/lista). */
  width?: "sm" | "md";
  /** Renderiza a barra fixa de chrome. Quando ligada, o padding-top reserva a altura dela. */
  chrome?: boolean;
  /** Classes da tela (gap, alinhamento). Nunca largura — a largura é do shell. */
  className?: string;
}) {
  return (
    <>
      <GrainOverlay />
      {chrome ? <ChromeBar width={width} /> : null}
      <main
        className={[
          "mx-auto flex w-full min-h-dvh flex-col px-6",
          chrome ? "pt-20 pb-10" : "py-10",
          width === "md" ? "max-w-md" : "max-w-sm",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </main>
    </>
  );
}
