// src/shared/hooks/useIsMounted.ts
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useIsMounted() {
  // We use the presence of the 'window' as our external store
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // Client snapshot
    () => false // Server snapshot
  );
}
