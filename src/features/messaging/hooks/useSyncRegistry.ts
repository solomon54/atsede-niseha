//src/features/messaging/hooks/useSyncRegistry.ts

import { useEffect } from "react";

import { getPusherClient } from "@/services/pusher";

import { syncService } from "../services/sync.service";

/**
 * Hook mounted at Dashboard/Layout level for coordinated single-flight sync.
 * `userId` scopes outbox draining to the signed-in account.
 */
export function useSyncRegistry(userId?: string) {
  useEffect(() => {
    if (!userId) return;

    // 1. Initial sync on dashboard mount
    syncService.sync(undefined, userId).catch(() => {});

    // 2. Listen for network reconnection
    const handleOnline = () => {
      syncService.sync(undefined, userId).catch(() => {});
    };

    window.addEventListener("online", handleOnline);

    // 3. Listen for Pusher reconnect to heal any missed real-time events
    let handlePusherConnected: (() => void) | undefined;
    try {
      const pusher = getPusherClient();
      handlePusherConnected = () => {
        syncService.sync(undefined, userId).catch(() => {});
      };
      pusher.connection.bind("connected", handlePusherConnected);
    } catch (e) {
      console.warn("Pusher connection listener failed:", e);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      if (handlePusherConnected) {
        try {
          getPusherClient().connection.unbind(
            "connected",
            handlePusherConnected
          );
        } catch {
          // Pusher client may already be disconnected.
        }
      }
    };
  }, [userId]);
}
