import { useEffect, type RefObject } from "react";

// 4 linhas de texto (20px de line-height) + o padding do campo. Depois disso o
// campo rola por dentro em vez de continuar crescendo (FR-023).
const MAX_FIELD_PX = 96;

export function useAutoGrowTextarea(fieldRef: RefObject<HTMLTextAreaElement | null>, value: string) {
  // O campo cresce até 4 linhas e para (FR-023). Medir `scrollHeight` exige
  // zerar a altura antes: com a altura travada, `scrollHeight` nunca passa da
  // altura que o campo já tinha.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    // `scrollHeight` é 0 sem layout (campo oculto, fonte ainda carregando) e
    // aplicar esse 0 fixava o campo achatado até a próxima tecla. Sem layout não
    // há altura a medir: o `auto` que está acima é a resposta certa, e o
    // `min-h-11` segura o alvo de toque.
    const measured = field.scrollHeight;
    if (measured <= 0) return;
    field.style.height = `${Math.min(measured, MAX_FIELD_PX)}px`;
  }, [fieldRef, value]);
}
