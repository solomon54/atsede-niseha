//src/features/messaging/hooks/useSyncRegistry.ts

import { useEffect } from "react";

import { syncService } from "../services/sync.service";

/**
 * Hook to be called in your main Dashboard/Layout.
 */
export function useSyncRegistry() {
  useEffect(() => {
    // 1. Sync immediately on load
    syncService.syncPendingMessages();

    // 2. Listen for the browser coming back online
    const handleOnline = () => {
      console.log("[NETWORK] Connection restored. Starting Sync...");
      syncService.syncPendingMessages();
    };

    window.addEventListener("online", handleOnline);

    // 3. Periodic heartbeat (every 5 mins) just in case
    const interval = setInterval(() => {
      if (navigator.onLine) syncService.syncPendingMessages();
    }, 1000 * 60 * 5);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, []);
}
