"use client";

import { useEffect, useState } from "react";

export function RoomIris() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setDone(true), 400);
    return () => clearTimeout(timer);
  }, [done]);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      data-motif="iris"
      className="iris"
      onAnimationEnd={() => setDone(true)}
    />
  );
}
