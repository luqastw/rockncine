import type { ReactNode } from "react";
import { ChromeBar } from "./ChromeBar";
import { Fog } from "./Fog";

// Invólucro único de página (FR-018 da spec 14, mantido pela FR-008 da spec 15,
// docs/specs/15-identidade-kimi/spec.md): largura e padding vivem só aqui,
// no lugar das mesmas classes de `main` repetidas em cada tela.
//
// Sem "use client": precisa ser importado por páginas server (`/`, `/rooms`,
// 404) e pelos boundaries client (`error.tsx`).
export function PageShell({
  children,
  width = "sm",
  chrome = false,
  fog = false,
  className,
}: {
  children: ReactNode;
  /** Largura da coluna: `sm` (auth/estados), `md` (lista) ou `lg` (landing). */
  width?: "sm" | "md" | "lg";
  /** Renderiza a barra fixa de chrome. Quando ligada, o padding-top reserva a altura dela. */
  chrome?: boolean;
  fog?: boolean;
  /** Classes da tela (gap, alinhamento). Nunca largura — a largura é do shell. */
  className?: string;
}) {
  const maxWidth =
    width === "lg" ? "max-w-5xl" : width === "md" ? "max-w-3xl" : "max-w-[26rem]";

  return (
    <>
      {chrome ? <ChromeBar width={width} /> : null}
      <div className="relative flex min-h-dvh w-full flex-col overflow-x-clip">
        <main
          className={[
            "relative z-10 mx-auto flex w-full flex-1 flex-col px-6 sm:px-10",
            chrome ? "pt-24 sm:pt-28" : "pt-10 sm:pt-14",
            fog ? "pb-44 sm:pb-48" : chrome ? "pb-20 sm:pb-24" : "pb-10 sm:pb-14",
            maxWidth,
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
