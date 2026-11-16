import { Reveal } from "./Reveal";

export function Divider({ className }: { className?: string }) {
  const classes = ["divider-gold", className].filter(Boolean).join(" ");

  return (
    <Reveal>
      <div aria-hidden="true" data-motif="divider" className={classes} />
    </Reveal>
  );
}
