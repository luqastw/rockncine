// Glow ambiente da identidade Kimi (FR-006, docs/specs/15-identidade-kimi/spec.md).
// Camada puramente decorativa: `aria-hidden`, `pointer-events: none` e estática.
// Toda a aparência mora na classe `.ambient` de app/globals.css.
export function AmbientGlow() {
  return <div aria-hidden="true" className="ambient" />;
}
