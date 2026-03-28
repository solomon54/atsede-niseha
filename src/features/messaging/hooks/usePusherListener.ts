//src/features/messaging/hooks/usePusherListener.ts

/**
 * EOTC Sacred Ledger — Pusher to Ledger Bridge (Type-Safe)
 * ============================================================
 * Listens for realtime events, commits them to Dexie,
 * and synchronizes the Identity Registry (Members).
 */

import { useEffect } from "react";

import { getPusherClient } from "@/services/pusher";

import { db, LocalLedgerMessage } from "../db/ladger-db";
import {
  ChannelID,
  ChannelRole,
  Message,
  MessageID,
  UID,
} from "../types/messaging.types";

/**
 * Enriched Server Payload for realtime events
 */
interface EnrichedMessagePayload extends Message {
  senderName?: string;
  senderPhoto?: string;
  senderRole?: ChannelRole;
  isDiacon?: boolean;
}

export function usePusherListener(channelId: ChannelID) {
  useEffect(() => {
    if (!channelId) return;

    const pusher = getPusherClient();
    const channelName = `private-chat-${channelId}`;
    const channel = pusher.subscribe(channelName);

    /**
     * 1. Handle New Messages
     * Dual Responsibility: Update Identity Registry + Commit Message
     */
    channel.bind("new-message", async (payload: EnrichedMessagePayload) => {
      try {
        // --- STEP A: Identity Registry Update ---
        // Ensure Name/Photo/Role shows up even if this is a new contact
        if (payload.senderName) {
          await db.members.put({
            id: payload.senderId,
            fullName: payload.senderName,
            role: payload.senderRole || "CHILD",
            photoUrl: payload.senderPhoto,
            isDiacon: payload.isDiacon || false,
          });
        }

        // --- STEP B: Message Ledger De-duplication ---
        const existing = await db.messages.get(payload.id);

        if (existing) {
          // If we sent this (optimistic), mark it as officially confirmed by server
          if (existing.status === "sending") {
            await db.messages.update(payload.id, {
              status: "sent",
              // Ensure we use server's official timestamp/URL if they changed
              createdAt: payload.createdAt,
              media: payload.media || existing.media,
            });
          }
          return;
        }

        const ledgerEntry: LocalLedgerMessage = {
          ...payload,
          status: "sent",
          isRead: false,
          version: "v1", // Mandatory Ledger Contract
        };

        await db.messages.add(ledgerEntry);
      } catch (err) {
        console.error("❌ [PUSHER_NEW_MSG] Ledger commit failed:", err);
      }
    });

    /**
     * 2. Handle Updates (Edits)
     */
    channel.bind("message-updated", async (payload: Message) => {
      try {
        await db.messages.update(payload.id, {
          ...payload,
          status: "sent",
        });
      } catch (err) {
        console.error("❌ [PUSHER_EDIT] Update failed:", err);
      }
    });

    /**
     * 3. Handle Deletions
     */
    channel.bind("message-deleted", async (data: { messageId: MessageID }) => {
      try {
        await db.messages.delete(data.messageId);
      } catch (err) {
        console.error("❌ [PUSHER_DELETE] Deletion failed:", err);
      }
    });

    /**
     * 4. Handle Read Receipts (Frugal/Batch Update)
     */
    channel.bind("message-seen", async (data: { lastMessageId: MessageID }) => {
      try {
        await db.messages
          .where("channelId")
          .equals(channelId)
          .and((m) => !m.isRead)
          .modify({ isRead: true });
      } catch (err) {
        console.error("❌ [PUSHER_READ] Status sync failed:", err);
      }
    });

    // Cleanup: Prevent memory leaks and redundant listeners
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [channelId]);
}
