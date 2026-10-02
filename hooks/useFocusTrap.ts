import type { RefObject } from "react";
import { useEffect } from "react";

// Trap de Tab para um painel de diálogo.
//
// `ConfirmDialog` e `LoadVideoModal` tinham esta mesma lista de focáveis
// caractere a caractere, e o `ConfirmDialog` foi extraído justamente para
// evitar a duplicação — que ficou. Dois lugares é o número a partir do qual um
// deles passa a divergir do outro, e o sintoma de um trap quebrado é o pior
// possível: o foco escapa do diálogo e some no fundo da página, sem erro
// nenhum no console.
//
// O seletor é o mesmo nos dois: só o que é focável e não está desabilitado.
const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Prende o Tab/Shift+Tab dentro de `panelRef` enquanto `active` for true.
 *
 * Só cicla entre o primeiro e o último focável: nos dois diálogos do app o
 * painel tem poucos elementos e nada fora dele é interativo naquela tela, então
 * o par extremos cobre o circuito todo. Um trap por busca no DOM a cada tecla
 * (o modelo de `focus-trap`) seria mais geral e mais caro, e não há tela aqui
 * que peça isso.
 */
export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape e o resto ficam com quem fecha o diálogo — o trap cuida só do
      // que ele promete: não deixar o foco sair.
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active_ = document.activeElement;

      if (e.shiftKey && active_ === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      if (!e.shiftKey && active_ === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelRef, active]);
}
