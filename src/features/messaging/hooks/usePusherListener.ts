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
    const handleNewMessage = async (payload: EnrichedMessagePayload) => {
      if (!payload?.id) return;
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
              createdAt: payload.createdAt || existing.createdAt,
              updatedAt: (payload as any).updatedAt || existing.updatedAt || payload.createdAt,
              media: payload.media || existing.media,
              callDetails: payload.callDetails || existing.callDetails,
              content: payload.content ?? existing.content,
              type: payload.type || existing.type,
              isEncrypted: payload.isEncrypted ?? existing.isEncrypted,
              encryption: payload.encryption || existing.encryption,
            });
          }
          return;
        }

        const ledgerEntry: LocalLedgerMessage = {
          ...payload,
          status: "sent",
          isRead: false,
          version: "v1", // Mandatory Ledger Contract
          updatedAt: (payload as any).updatedAt || payload.createdAt,
        };

        await db.messages.add(ledgerEntry);
      } catch (err) {
        console.error("❌ [PUSHER_NEW_MSG] Ledger commit failed:", err);
      }
    };

    /**
     * 2. Handle Updates (Edits / call detail transitions)
     * Merge with existing to avoid dropping fields on partial payloads.
     */
    const handleMessageUpdated = async (payload: Partial<Message> & { id?: MessageID }) => {
      if (!payload?.id) return;
      try {
        const existing = await db.messages.get(payload.id);
        if (!existing) {
          await db.messages.put({
            ...(payload as Message),
            status: "sent",
            version: "v1",
            createdAt: (payload.createdAt as number) || Date.now(),
            updatedAt: (payload.updatedAt as number) || Date.now(),
          } as LocalLedgerMessage);
          return;
        }
        await db.messages.update(payload.id, {
          ...existing,
          ...payload,
          status: "sent",
          updatedAt: (payload.updatedAt as number) || existing.updatedAt || Date.now(),
        });
      } catch (err) {
        console.error("❌ [PUSHER_EDIT] Update failed:", err);
      }
    };

    /**
     * 3. Handle Deletions (Tombstone pattern)
     */
    const handleMessageDeleted = async (data: { messageId: MessageID }) => {
      if (!data?.messageId) return;
      try {
        await db.messages.update(data.messageId, {
          deletedAt: Date.now(),
          content: "[deleted]",
          media: null,
        });
      } catch (err) {
        console.error("❌ [PUSHER_DELETE] Tombstone failed:", err);
      }
    };

    /**
     * 4. Handle Reactions
     */
    const handleMessageReaction = async (data: {
      messageId: MessageID;
      reactions: Record<string, string[]>;
    }) => {
      if (!data?.messageId) return;
      try {
        await db.messages.update(data.messageId, {
          reactions: data.reactions || {},
        });
      } catch (err) {
        console.error("❌ [PUSHER_REACTION] Reaction update failed:", err);
      }
    };

    /**
     * 5. Handle Read Receipts (Frugal/Batch Update)
     */
    const handleMessageSeen = async (_data: { lastMessageId: MessageID }) => {
      try {
        await db.messages
          .where("channelId")
          .equals(channelId)
          .and((m) => !m.isRead)
          .modify({ isRead: true });
      } catch (err) {
        console.error("❌ [PUSHER_READ] Status sync failed:", err);
      }
    };

    channel.bind("new-message", handleNewMessage);
    channel.bind("message-updated", handleMessageUpdated);
    channel.bind("message-deleted", handleMessageDeleted);
    channel.bind("message-reaction", handleMessageReaction);
    channel.bind("message-seen", handleMessageSeen);

    // Cleanup: unbind only this hook's handlers. Do NOT unsubscribe the shared
    // channel because MessagingClient also relies on the same subscription.
    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-updated", handleMessageUpdated);
      channel.unbind("message-deleted", handleMessageDeleted);
      channel.unbind("message-reaction", handleMessageReaction);
      channel.unbind("message-seen", handleMessageSeen);
    };
  }, [channelId]);
}
