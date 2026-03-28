// src/features/messaging/hooks/useMessages.ts

"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect } from "react";

import { CachedMember, db, LocalLedgerMessage } from "../db/ladger-db";
import { encryptionService } from "../services/encryption.service";
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
   * 1. ATOMIC SYNC LOGIC
   * Prevents overwriting local 'sending' states with 'sent' states from the server
   * until the server confirms the specific message.
   */
  const syncLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/message/list?channelId=${channelId}`);
      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();
      if (!Array.isArray(data)) return;

      // Wrap in a transaction for atomicity and performance
      await db.transaction("rw", [db.members, db.messages], async () => {
        // A. Sync Members (Identity Registry)
        const memberProfiles: CachedMember[] = data.map((m) => ({
          id: m.senderId,
          fullName: m.senderName || "የቤተሰብ አባል",
          role: m.senderRole || "CHILD",
          photoUrl: m.senderPhoto,
          isDiacon: m.isDiacon || false,
        }));
        await db.members.bulkPut(memberProfiles);

        // B. Smart Message Merge
        // We only "put" messages that aren't currently in a 'sending' state locally
        for (const remoteMsg of data) {
          const localMsg = await db.messages.get(remoteMsg.id);

          // Strategy: Don't overwrite if local version is currently uploading
          if (!localMsg || localMsg.status !== "sending") {
            await db.messages.put({
              ...remoteMsg,
              status: "sent",
              version: "v1",
            });
          }
        }
      });
    } catch (err) {
      // If offline, we fail silently because useLiveQuery still provides the cached data
      console.warn("Ledger Sync suspended (Offline mode):", err);
    }
  }, [channelId]);

  // Trigger sync on mount or channel change
  useEffect(() => {
    if (channelId) syncLedger();

    // Optional: Sync when returning to the tab/regaining focus
    window.addEventListener("focus", syncLedger);
    return () => window.removeEventListener("focus", syncLedger);
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

    // Cache member lookups within this single query run to avoid redundant DB hits
    const memberCache = new Map<string, CachedMember>();

    return await Promise.all(
      rawMessages.map(async (msg): Promise<EnrichedMessage> => {
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
          } catch (err) {
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
