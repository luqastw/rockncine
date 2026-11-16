import Image from "next/image";
import { cx } from "@/lib/cx";

export function Fairy({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/fairy.png"
      alt=""
      width={96}
      height={96}
      unoptimized
      aria-hidden="true"
      data-motif="fairy"
      className={cx("size-16 drop-shadow-[0_0_10px_var(--fairy)]", className)}
    />
  );
}
