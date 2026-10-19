import type { ReactNode } from "react";
import { ChromeBar } from "./ChromeBar";
import { AmbientGlow } from "./AmbientGlow";

// Invólucro único de página (FR-018 da spec 14, mantido pela FR-008 da spec 15,
// docs/specs/15-identidade-kimi/spec.md): largura, padding e glow vivem só aqui,
// no lugar das mesmas classes de `main` repetidas em cada tela. O glow não fica
// no layout raiz — ele é ancestral da sala, e textura/glow ali quebraria o
// contrato de superfície da sala.
//
// Sem "use client": precisa ser importado por páginas server (`/`, `/rooms`,
// 404) e pelos boundaries client (`error.tsx`).
export function PageShell({
  children,
  width = "sm",
  chrome = false,
  className,
}: {
  children: ReactNode;
  /** Largura da coluna: `sm` (auth/estados), `md` (lista) ou `lg` (landing). */
  width?: "sm" | "md" | "lg";
  /** Renderiza a barra fixa de chrome. Quando ligada, o padding-top reserva a altura dela. */
  chrome?: boolean;
  /** Classes da tela (gap, alinhamento). Nunca largura — a largura é do shell. */
  className?: string;
}) {
  const maxWidth =
    width === "lg" ? "max-w-5xl" : width === "md" ? "max-w-3xl" : "max-w-[26rem]";

  return (
    <>
      <AmbientGlow />
      {chrome ? <ChromeBar width={width} /> : null}
      <main
        className={[
          "relative z-10 mx-auto flex min-h-dvh w-full flex-col px-6 sm:px-10",
          chrome ? "pt-24 pb-12 sm:pt-28" : "py-10 sm:py-14",
          maxWidth,
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
