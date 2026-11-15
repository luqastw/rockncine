"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { DEFAULT_AVATAR_SRC, avatarSrc } from "@/lib/avatar";

export const Avatar = memo(function Avatar({
  userId,
  avatarV,
  size,
}: {
  userId: string;
  avatarV?: number | null;
  size: "sm" | "md";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const computed = avatarSrc(userId, avatarV ?? undefined);
  const src = failedSrc === computed ? DEFAULT_AVATAR_SRC : computed;
  const dimension = size === "sm" ? 20 : 28;
  const box = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <Image
      unoptimized
      src={src}
      alt=""
      width={dimension}
      height={dimension}
      decoding="async"
      className={`${box} shrink-0 rounded-full object-cover`}
      onError={() => {
        if (src === DEFAULT_AVATAR_SRC) return;
        setFailedSrc(computed);
      }}
    />
  );
});
