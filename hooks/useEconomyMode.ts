"use client";

import { useEffect } from "react";

export function useEconomyMode(economyMode: boolean) {
  useEffect(() => {
    if (economyMode) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
    return () => document.documentElement.classList.remove("reduce-motion");
  }, [economyMode]);
}
