"use client";

import { useSyncRegistry } from "@/features/messaging/hooks/useSyncRegistry";

export function SyncRegistryBridge({ userId }: { userId?: string }) {
  useSyncRegistry(userId);
  return null;
}
