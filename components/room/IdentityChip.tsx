"use client";

import { memo } from "react";
import { initialsOf, toneOf, toneToken } from "@/lib/identity";

// Identidade visual do participante: iniciais + um de quatro tons de cinza
// derivados do `userId` (FR-018, docs/specs/13-chat-sala/spec.md).
//
// Avatar colorido por participante é o que qualquer produto de sala tem e o que
// esta casa proíbe: a direção é monocromática e estado se marca por contraste,
// inversão ou peso — nunca matiz (spec 01, seção 8). Por isso a diferenciação
// entre duas pessoas é POR FORMA (as iniciais) e POR PESO (o tom), e não por
// cor.
//
// Vive em arquivo próprio porque dois lugares precisam dele: o cabeçalho da
// fala no log e a lista de presença. Componente duplicado seriam dois lugares
// com a mesma escolha de tom para acertar.
export const IdentityChip = memo(function IdentityChip({
  name,
  userId,
  size,
}: {
  name: string;
  userId: string;
  size: "sm" | "md";
}) {
  const tone = toneOf(userId);
  const initials = initialsOf(name);
  const box = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <span
      // Duplicado de propósito: o nome já está escrito ao lado do chip na lista
      // de presença e no cabeçalho da fala, e o leitor de tela não precisa
      // ouvir "B, Bruno" duas vezes.
      aria-hidden
      data-tone={tone}
      data-initials={initials}
      className={`flex ${box} shrink-0 items-center justify-center rounded-[4px] font-medium text-[var(--pure-black)]`}
      style={{ backgroundColor: toneToken(tone) }}
    >
      {initials}
    </span>
  );
});