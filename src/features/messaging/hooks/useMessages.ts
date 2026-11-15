// src/features/messaging/hooks/useMessages.ts

"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect } from "react";

import { getPusherClient } from "@/services/pusher";

import { CachedMember, db } from "../db/ladger-db";
import { encryptionService } from "../services/encryption.service";
import { syncService } from "../services/sync.service";
import { ChannelID, ChannelRole, Message } from "../types/messaging.types";

export interface EnrichedMessage extends Message {
  senderName: string;
  senderRole: ChannelRole;
  senderPhoto?: string;
  isDiacon: boolean;
  status: "sending" | "sent" | "error";
}

export function useMessages(channelId: ChannelID) {
  /**
   * 1. SINGLE-FLIGHT DELTA SYNC
   * Pulls only changes since last sync cursor; does not refetch on focus.
   */
  const syncLedger = useCallback(async () => {
    if (!channelId) return;
    try {
      await syncService.sync(channelId);
    } catch (err) {
      console.warn("Ledger Sync suspended (Offline mode):", err);
    }
  }, [channelId]);

  // Trigger delta sync on mount or channel change only
  useEffect(() => {
    if (channelId) syncLedger();
  }, [channelId, syncLedger]);

  // Heal gaps after the socket dropped or the tab was offline/backgrounded.
  // Pulling the delta is idempotent and uses the persisted server cursor.
  useEffect(() => {
    if (!channelId) return;

    const handleRecovery = () => syncLedger();

    window.addEventListener("online", handleRecovery);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleRecovery();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let unbindPusher: (() => void) | undefined;
    try {
      const pusher = getPusherClient();
      pusher.connection.bind("connected", handleRecovery);
      unbindPusher = () =>
        pusher.connection.unbind("connected", handleRecovery);
    } catch {
      // Pusher may not be configured in this environment.
    }

    return () => {
      window.removeEventListener("online", handleRecovery);
      document.removeEventListener("visibilitychange", handleVisibility);
      unbindPusher?.();
    };
  }, [channelId, syncLedger]);

  /**
   * 2. REACTIVE ENRICHMENT ENGINE
   */
  const messages = useLiveQuery(async () => {
    // We use the composite index for blazing fast retrieval
    const rawMessages = await db.messages
      .where("[channelId+createdAt]")
      .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
      .toArray();

    // Filter out messages that are marked as deleted either by content or the deletedAt flag
    const activeMessages = rawMessages.filter(
      (msg) => msg.content !== "[deleted]" && !msg.deletedAt
    );

    // Cache member lookups within this single query run to avoid redundant DB hits
    const memberCache = new Map<string, CachedMember>();

    return await Promise.all(
      activeMessages.map(async (msg): Promise<EnrichedMessage> => {
        // 1. Resolve Identity
        let memberInfo = memberCache.get(msg.senderId);
        if (!memberInfo) {
          memberInfo = await db.members.get(msg.senderId);
          if (memberInfo) memberCache.set(msg.senderId, memberInfo);
        }

        // 2. Resolve Content (E2EE Decryption)
        let displayContent = msg.content;
        if (msg.isEncrypted && msg.encryption && msg.content) {
          try {
            displayContent = await encryptionService.decrypt(
              msg.content,
              msg.encryption
            );
          } catch {
            // If we can't decrypt, show the locked placeholder
            displayContent = "[የተቆለፈ መልእክት]";
          }
        }

        return {
          ...msg,
          content: displayContent,
          senderName: memberInfo?.fullName || "የቤተሰብ አባል",
          senderRole: (memberInfo?.role as ChannelRole) || "CHILD",
          senderPhoto: memberInfo?.photoUrl,
          isDiacon: memberInfo?.isDiacon || false,
          status: (msg.status as "sending" | "sent" | "error") || "sent",
        };
      })
    );
  }, [channelId]);

  return {
    messages: (messages as EnrichedMessage[]) ?? [],
    isLoading: messages === undefined,
    sync: syncLedger, // Allow manual refresh UI to trigger this
  };
}
