//src/features/messaging/services/sync.service.ts

/**
 * EOTC Sacred Ledger — Coordinated Sync Manager (Single-Flight Engine)
 * ============================================================
 * Ensures zero data loss by:
 * 1. Pushing local outbox operations first with idempotency.
 * 2. Pulling only delta records using sync cursors.
 * 3. Coalescing concurrent sync triggers into a single-flight execution.
 */

import {
  db,
  LocalConversation,
  LocalLedgerMessage,
  OutboxOperation,
} from "../db/ladger-db";
import { ConversationSummary } from "../types/messaging.types";

let currentSyncPromise: Promise<void> | null = null;

export const syncService = {
  /**
   * Main entry point: Single-flight coordinator.
   */
  async sync(activeChannelId?: string): Promise<void> {
    if (currentSyncPromise) {
      return currentSyncPromise;
    }

    currentSyncPromise = this.executeSync(activeChannelId).finally(() => {
      currentSyncPromise = null;
    });

    return currentSyncPromise;
  },

  async executeSync(activeChannelId?: string): Promise<void> {
    if (typeof window !== "undefined" && !navigator.onLine) {
      return;
    }

    try {
      // 1. Drain Pending Outbox Operations First
      await this.drainOutbox();

      // 2. Sync Conversations List into Dexie
      await this.syncConversations();

      // 3. If an active channel is selected, sync its delta messages
      if (activeChannelId) {
        await this.syncChannelMessages(activeChannelId);
      }
    } catch (err) {
      console.warn("[SYNC] Sync cycle encountered an error:", err);
    }
  },

  /**
   * Step A: Drain Outbox operations in FIFO order
   */
  async drainOutbox(): Promise<void> {
    // 1. Check operations table
    const ops = await db.outbox.orderBy("createdAt").toArray();

    for (const op of ops) {
      if (typeof window !== "undefined" && !navigator.onLine) break;

      try {
        if (op.type === "SEND_MESSAGE") {
          let mediaPayload = op.payload.media;

          // If message has localBlob but no remote URL yet, upload media first
          const localMsg = await db.messages.get(op.payload.clientMessageId);
          if (localMsg?.localBlob && (!mediaPayload || !mediaPayload.url || mediaPayload.url.startsWith("blob:"))) {
            const formData = new FormData();
            formData.append("file", localMsg.localBlob);
            formData.append("channelId", op.channelId);

            const uploadRes = await fetch("/api/message/chat-media-upload", {
              method: "POST",
              body: formData,
            });

            if (uploadRes.ok) {
              const uploadJson = await uploadRes.json();
              if (uploadJson?.media) {
                mediaPayload = uploadJson.media;
              }
            }
          }

          const res = await fetch("/api/message/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...op.payload,
              media: mediaPayload,
            }),
          });

          const result = await res.json().catch(() => ({}));
          if (res.ok || result.redundant) {
            await db.outbox.delete(op.operationId);
            if (op.payload.clientMessageId) {
              const local = await db.messages
                .where("clientMessageId")
                .equals(op.payload.clientMessageId)
                .first();
              if (local) {
                await db.messages.update(local.id, {
                  status: "sent",
                  id: (result.messageId || local.id) as any,
                });
              }
            }
          } else if (res.status >= 400 && res.status < 500) {
            // Permanent rejection
            await db.outbox.update(op.operationId, {
              status: "failed",
              errorMessage: result.error || "Rejected",
            });
          }
        } else if (op.type === "EDIT_MESSAGE") {
          const res = await fetch("/api/message/edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op.payload),
          });
          if (res.ok) {
            await db.outbox.delete(op.operationId);
          }
        } else if (op.type === "DELETE_MESSAGE") {
          const res = await fetch("/api/message/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op.payload),
          });
          if (res.ok) {
            await db.outbox.delete(op.operationId);
          }
        } else if (op.type === "MARK_READ") {
          const res = await fetch("/api/message/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op.payload),
          });
          if (res.ok) {
            await db.outbox.delete(op.operationId);
          }
        }
      } catch (e) {
        console.warn(`[SYNC] Outbox op ${op.operationId} failed, pausing:`, e);
        break; // Network error, pause until next window
      }
    }

    // 2. Also check any legacy messages stuck in 'sending' state
    const pendingMsgs = await db.messages
      .where("status")
      .equals("sending")
      .sortBy("createdAt");

    for (const msg of pendingMsgs) {
      if (typeof window !== "undefined" && !navigator.onLine) break;

      try {
        const response = await fetch("/api/message/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: msg.channelId,
            content: msg.content,
            type: msg.type,
            clientMessageId: msg.clientMessageId,
            media: msg.media,
            isEncrypted: msg.isEncrypted,
            encryption: msg.encryption,
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (response.ok || result.redundant) {
          await db.markAsSent(msg.id);
        }
      } catch {
        break;
      }
    }
  },

  /**
   * Step B: Sync Conversation List into Dexie
   */
  async syncConversations(): Promise<void> {
    try {
      const res = await fetch("/api/message/conversation", {
        credentials: "include",
      });
      if (!res.ok) return;

      const data: ConversationSummary[] = await res.json();
      if (!Array.isArray(data)) return;

      const localConvos: LocalConversation[] = data.map((c) => ({
        id: c.channel.id,
        role: c.channel.type === "COMMON_HOUSE" ? "COMMON_HOUSE" : "DIRECT",
        title: c.channel.title,
        fullName: c.fullName,
        photoUrl: c.photoUrl,
        lastMessage: c.lastMessage
          ? {
              id: c.lastMessage.id,
              content: c.lastMessage.content || "",
              createdAt: c.lastMessage.createdAt,
              senderId: c.lastMessage.senderId,
              type: c.lastMessage.type,
              media: c.lastMessage.media,
              isEncrypted: c.lastMessage.isEncrypted,
              callDetails: (c.lastMessage as any).callDetails,
            }
          : null,
        lastMessageAt: c.channel.lastMessageAt || c.lastMessage?.createdAt || 0,
        unreadCount: c.unreadCount || 0,
        members: c.members?.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          role: m.role,
          photoUrl: m.photoUrl,
        })),
        updatedAt: Date.now(),
      }));

      await db.conversations.bulkPut(localConvos);
      await db.syncMeta.put({ key: "conversations", lastSyncAt: Date.now() });
    } catch (e) {
      console.warn("[SYNC] Conversation list sync failed:", e);
    }
  },

  /**
   * Step C: Delta Sync Messages for a Channel using Cursors
   */
  async syncChannelMessages(channelId: string): Promise<void> {
    try {
      const metaKey = `channel_${channelId}`;
      const meta = await db.syncMeta.get(metaKey);
      const sinceParam = meta?.lastSyncAt ? `&since=${meta.lastSyncAt}` : "&limit=30";

      const res = await fetch(`/api/message/list?channelId=${channelId}${sinceParam}`);
      if (!res.ok) return;

      const remoteMessages = await res.json();
      if (!Array.isArray(remoteMessages) || remoteMessages.length === 0) {
        // Even if 0 messages, record cursor to advance time
        await db.syncMeta.put({ key: metaKey, lastSyncAt: Date.now() });
        return;
      }

      let latestModTime = meta?.lastSyncAt || 0;

      await db.transaction("rw", [db.members, db.messages], async () => {
        for (const remoteMsg of remoteMessages) {
          const modTime = remoteMsg.updatedAt || remoteMsg.createdAt || Date.now();
          if (modTime > latestModTime) {
            latestModTime = modTime;
          }

          // Identity caching
          if (remoteMsg.senderName) {
            await db.members.put({
              id: remoteMsg.senderId,
              fullName: remoteMsg.senderName,
              role: remoteMsg.senderRole || "CHILD",
              photoUrl: remoteMsg.senderPhoto,
              isDiacon: remoteMsg.isDiacon || false,
            });
          }

          const local = await db.messages.get(remoteMsg.id);

          // Handle deletions
          if (remoteMsg.deletedAt) {
            if (local) {
              await db.messages.update(remoteMsg.id, {
                deletedAt: remoteMsg.deletedAt,
                content: "[deleted]",
                media: null,
                updatedAt: remoteMsg.updatedAt || Date.now(),
              });
            }
            continue;
          }

          // Do not overwrite local optimistic messages currently in-flight
          if (!local || local.status !== "sending") {
            await db.messages.put({
              ...remoteMsg,
              status: "sent",
              version: "v1",
              localBlob: local?.localBlob,
              updatedAt: remoteMsg.updatedAt || remoteMsg.createdAt,
            });
          }
        }
      });

      await db.syncMeta.put({
        key: metaKey,
        lastSyncAt: Math.max(latestModTime, Date.now() - 1000),
      });
    } catch (e) {
      console.warn(`[SYNC] Delta sync for channel ${channelId} failed:`, e);
    }
  },

  /**
   * Queue an outbox operation for reliable offline execution
   */
  async queueOperation(
    channelId: string,
    type: OutboxOperation["type"],
    payload: any
  ): Promise<string> {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const op: OutboxOperation = {
      operationId,
      channelId,
      type,
      payload,
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    };

    await db.outbox.add(op);

    // Trigger sync in background if online
    if (typeof window !== "undefined" && navigator.onLine) {
      this.sync(channelId).catch(() => {});
    }

    return operationId;
  },

  /**
   * Backward-compatible helper for useSyncRegistry
   */
  async syncPendingMessages() {
    return this.sync();
  },
};
