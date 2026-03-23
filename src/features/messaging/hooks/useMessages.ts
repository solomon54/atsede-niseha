//src/features/messaging/hooks/useMessages.ts

/**
 * EOTC Sacred Ledger — Reactive, Decrypted & Enriched Observer
 * ============================================================
 * Joins Messages with Members in Dexie with strict typing.
 */

"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";

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
  // 1. INITIAL SYNC: Fetch from API and populate Dexie
  useEffect(() => {
    async function syncLedger() {
      try {
        const res = await fetch(`/api/message/list?channelId=${channelId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (Array.isArray(data)) {
          // Sync Member Registry
          const memberProfiles: CachedMember[] = data.map((m) => ({
            id: m.senderId,
            fullName: m.senderName || "የቤተሰብ አባል",
            role: m.senderRole || "CHILD",
            photoUrl: m.senderPhoto,
            isDiacon: m.isDiacon || false,
          }));
          await db.members.bulkPut(memberProfiles);

          // Sync Message Ledger (Ensures sizeBytes and metadata are correct)
          const ledgerEntries: LocalLedgerMessage[] = data.map((m) => ({
            ...m,
            status: "sent",
            version: "v1",
          }));
          await db.messages.bulkPut(ledgerEntries);
        }
      } catch (err) {
        console.error("Ledger Sync Failure:", err);
      }
    }

    if (channelId) syncLedger();
  }, [channelId]);

  // 2. REACTIVE OBSERVER: Listen to Dexie changes (from Sync or Pusher)
  const messages = useLiveQuery(async () => {
    const rawMessages = await db.messages
      .where("[channelId+createdAt]")
      .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
      .toArray();

    const memberCache = new Map<string, CachedMember>();

    return await Promise.all(
      rawMessages.map(async (msg): Promise<EnrichedMessage> => {
        // Identity Lookup
        let memberInfo = memberCache.get(msg.senderId);
        if (!memberInfo) {
          const found = await db.members.get(msg.senderId);
          if (found) {
            memberInfo = found;
            memberCache.set(msg.senderId, found);
          }
        }

        // Decryption Logic
        let displayContent = msg.content;
        if (msg.isEncrypted && msg.encryption && msg.content) {
          try {
            displayContent = await encryptionService.decrypt(
              msg.content,
              msg.encryption
            );
          } catch (err) {
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
          status: msg.status || "sent",
        };
      })
    );
  }, [channelId]);

  return {
    messages: (messages as EnrichedMessage[]) ?? [],
    isLoading: messages === undefined,
    count: messages?.length ?? 0,
  };
}
