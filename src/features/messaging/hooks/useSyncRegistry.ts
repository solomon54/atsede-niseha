//src/features/messaging/hooks/useSyncRegistry.ts

import { useEffect } from "react";

import { appointmentOfflineService } from "@/features/appointments/services/appointmentOfflineService";
import { getPusherClient } from "@/services/pusher";

import { syncService } from "../services/sync.service";

/**
 * Hook mounted at Dashboard/Layout level for coordinated single-flight sync.
 * `userId` scopes outbox draining to the signed-in account.
 */
export function useSyncRegistry(userId?: string) {
  useEffect(() => {
    if (!userId) return;

    const runSync = () => {
      syncService.sync(undefined, userId).catch(() => {});
      appointmentOfflineService.drain(userId).catch(() => {});
    };

    // 1. Initial sync on dashboard mount
    runSync();

    // 2. Listen for network reconnection
    const handleOnline = () => {
      runSync();
    };

    window.addEventListener("online", handleOnline);

    // 3. Listen for Pusher reconnect to heal any missed real-time events
    let handlePusherConnected: (() => void) | undefined;
    try {
      const pusher = getPusherClient();
      handlePusherConnected = () => {
        runSync();
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
