// Camada de grão estática (FR-007/FR-008, docs/specs/14-identidade-fanzine-crt/spec.md).
// É um nó puro: server component, sem estado e sem API de servidor, para poder ser
// importado tanto por páginas server quanto pelos boundaries client (`error.tsx`).
//
// Toda a aparência (posição, opacidade, ausência de animação) mora na classe `.grain`
// de app/globals.css — aqui só se monta o elemento decorativo.
export function GrainOverlay() {
  return <div aria-hidden="true" className="grain" />;
}
