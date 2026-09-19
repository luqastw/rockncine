"use client";

import { useEffect } from "react";

// O selo do Liveblocks é injetado por eles direto no `document.body` — não é
// componente nosso e nenhuma prop do provider aceita rótulo. O botão de
// esconder dele chega ao DOM com `outline: none` inline, 18x18 e opacidade 0
// até o hover: é um controle alcançável por Tab sem nada visível mostrando que
// foi alcançado, e sem nome para leitor de tela (achado 1 da revisão de
// design). O CSS do anel e da área de toque mora em `globals.css` (o estilo é
// inline, precisa de `!important`); aqui vai só o nome acessível, que CSS não
// consegue dar.
//
// O selo é injetado quando o provider monta, e efeito de filho roda ANTES do
// efeito do pai em React: a primeira tentativa quase sempre falha, daí as
// repetidas. Elas param assim que o nó aparece (ou depois do teto) — um
// MutationObserver no body seria disparado a cada mensagem de chat.
const TENTATIVAS = 12;
const INTERVALO_MS = 200;

export function LiveblocksBadgeA11y() {
  useEffect(() => {
    const adotar = () => {
      const botao = document.getElementById("liveblocks-badge-hide-button");
      if (!botao) return false;
      if (!botao.hasAttribute("aria-label")) {
        botao.setAttribute("aria-label", "esconder o selo do Liveblocks");
      }
      return true;
    };

    if (adotar()) return;

    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas += 1;
      if (adotar() || tentativas >= TENTATIVAS) window.clearInterval(timer);
    }, INTERVALO_MS);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
