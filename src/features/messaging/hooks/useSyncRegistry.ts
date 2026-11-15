//src/features/messaging/hooks/useSyncRegistry.ts

import { useEffect } from "react";
import { getPusherClient } from "@/services/pusher";
import { syncService } from "../services/sync.service";

/**
 * Hook mounted at Dashboard/Layout level for coordinated single-flight sync.
 */
export function useSyncRegistry() {
  useEffect(() => {
    // 1. Initial sync on app start
    syncService.sync().catch(() => {});

    // 2. Listen for network reconnection
    const handleOnline = () => {
      syncService.sync().catch(() => {});
    };

    window.addEventListener("online", handleOnline);

    // 3. Listen for Pusher reconnect to heal any missed real-time events
    try {
      const pusher = getPusherClient();
      pusher.connection.bind("connected", () => {
        syncService.sync().catch(() => {});
      });
    } catch (e) {
      console.warn("Pusher connection listener failed:", e);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
