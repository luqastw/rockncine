import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, isClient, isServer);
}
