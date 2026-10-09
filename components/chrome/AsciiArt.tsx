// Arte ASCII decorativa (FR-009, docs/specs/14-identidade-fanzine-crt/spec.md):
// `<pre aria-hidden="true">` — o leitor de tela não a alcança, e o texto que ela
// ilustra existe à parte (o `h1`). Server component: só recebe as linhas prontas.
export function AsciiArt({ art }: { art: readonly string[] }) {
  return (
    <pre
      aria-hidden="true"
      className="ascii font-display select-none leading-tight text-[var(--ascii-ink)]"
    >
      {art.join("\n")}
    </pre>
  );
}
