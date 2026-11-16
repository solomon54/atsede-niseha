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

/**
 * Resolve the authenticated account for outbox work. There is intentionally
 * no "unknown account" fallback: unowned operations must never be executed.
 */
function resolveCurrentUserId(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (typeof window === "undefined") return undefined;

  const direct = localStorage.getItem("atsede_niseha_uid");
  if (direct) return direct;

  try {
    const session = JSON.parse(
      localStorage.getItem("sacred_ledger_session") || "{}"
    );
    return typeof session?.uid === "string" ? session.uid : undefined;
  } catch {
    return undefined;
  }
}

export const syncService = {
  /**
   * Main entry point: Single-flight coordinator.
   */
  async sync(activeChannelId?: string, currentUserId?: string): Promise<void> {
    if (currentSyncPromise) {
      return currentSyncPromise;
    }

    currentSyncPromise = this.executeSync(activeChannelId, currentUserId).finally(() => {
      currentSyncPromise = null;
    });

    return currentSyncPromise;
  },

  async executeSync(activeChannelId?: string, currentUserId?: string): Promise<void> {
    if (typeof window !== "undefined" && !navigator.onLine) {
      return;
    }

    try {
      // 1. Drain Pending Outbox Operations First (Account-isolated)
      await this.drainOutbox(currentUserId);

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
  async drainOutbox(currentUserId?: string): Promise<void> {
    const resolvedUid = resolveCurrentUserId(currentUserId);

    // No authenticated owner -> do nothing. Draining "all" here would replay
    // one account's queue under another account's session or anonymously.
    if (!resolvedUid) return;

    // Backfill/quarantine rows left unowned by older releases before filtering.
    await db.migrateLegacyOutboxOwnership();

    // Only pending operations explicitly owned by this account may run.
    const ops = await db.outbox
      .orderBy("createdAt")
      .filter(
        (op) => op.userId === resolvedUid && op.status === "pending"
      )
      .toArray();

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

            if (!uploadRes.ok) {
              // Pause the queue instead of sending a local blob: URL that the
              // server cannot use. The operation stays pending for retry.
              throw new Error(
                `Media upload failed with status ${uploadRes.status}`
              );
            }

            const uploadJson = await uploadRes.json();
            if (!uploadJson?.media) {
              throw new Error("Media upload returned no media descriptor");
            }

            mediaPayload = uploadJson.media;
            // PERSIST media upload result in outbox immediately so a crash will not re-upload
            op.payload.media = mediaPayload;
            await db.outbox.update(op.operationId, {
              payload: op.payload,
            });
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
                const serverId = result.messageId as string | undefined;
                if (serverId && serverId !== local.id) {
                  // Dexie cannot change a primary key in place. Replace the
                  // optimistic row so the server ID and the temp ID do not
                  // both linger and render duplicates.
                  await db.transaction("rw", db.messages, async () => {
                    await db.messages.delete(local.id);
                    await db.messages.put({
                      ...local,
                      id: serverId as LocalLedgerMessage["id"],
                      status: "sent",
                      errorMessage: undefined,
                    });
                  });
                } else {
                  await db.messages.update(local.id, {
                    status: "sent",
                    errorMessage: undefined,
                  });
                }
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

    // 2. Also check any legacy messages stuck in 'sending' state. They are only
    // replayed when they belong to the account that is currently authenticated.
    const pendingMsgs = await db.messages
      .where("status")
      .equals("sending")
      .sortBy("createdAt");

    for (const msg of pendingMsgs) {
      if (msg.senderId !== resolvedUid) continue;
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
              // Never persist/surface ciphertext in conversation previews.
              content:
                c.lastMessage.isEncrypted === true
                  ? ((c.lastMessage as any).decryptedPreview || "")
                  : (c.lastMessage.content || ""),
              createdAt: c.lastMessage.createdAt,
              senderId: c.lastMessage.senderId,
              type: c.lastMessage.type,
              media: c.lastMessage.media,
              isEncrypted: c.lastMessage.isEncrypted,
              callDetails: c.lastMessage.callDetails,
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

      // Advance only from a timestamp supplied by the server, and only after
      // the conversations were persisted successfully.
      const serverTimestamp = data.reduce((latest, c) => {
        const candidate =
          c.channel.lastMessageAt || c.lastMessage?.createdAt || 0;
        return Math.max(latest, candidate);
      }, 0);

      if (serverTimestamp > 0) {
        await db.syncMeta.put({
          key: "conversations",
          lastSyncAt: serverTimestamp,
        });
      }
    } catch (e) {
      console.warn("[SYNC] Conversation list sync failed:", e);
    }
  },

  /**
   * Step C: Delta Sync Messages for a Channel using Cursors
   * - Never advances cursor with Date.now()
   * - Loops while a batch is full
   * - Supports tiebreaker pagination via afterId
   * - Commits cursor strictly after transaction succeeds
   */
  async syncChannelMessages(channelId: string): Promise<void> {
    try {
      const metaKey = `channel_${channelId}`;
      let meta = await db.syncMeta.get(metaKey);
      let hasMore = true;
      let pageCount = 0;
      const PAGE_LIMIT = 30;
      const MAX_PAGES = 200;

      while (hasMore) {
        if (pageCount >= MAX_PAGES) {
          console.warn(
            `[SYNC] Delta sync for channel ${channelId} stopped after ${MAX_PAGES} pages.`
          );
          break;
        }
        pageCount += 1;

        const previous = meta;
        const isInitialPage = !previous?.lastSyncAt;
        const params = new URLSearchParams();
        params.set("channelId", channelId);
        params.set("limit", String(PAGE_LIMIT));
        if (previous?.lastSyncAt) {
          params.set("since", String(previous.lastSyncAt));
        }
        if (previous?.afterId) {
          params.set("afterId", previous.afterId);
        }

        const res = await fetch(`/api/message/list?${params.toString()}`);
        if (!res.ok) break;

        const remoteMessages = await res.json();
        if (!Array.isArray(remoteMessages) || remoteMessages.length === 0) {
          hasMore = false;
          break;
        }

        hasMore = remoteMessages.length >= PAGE_LIMIT;

        let batchLatestModTime = previous?.lastSyncAt || 0;
        let batchLastId = previous?.afterId;

        // Persist the whole batch before the cursor is allowed to move.
        await db.transaction("rw", [db.members, db.messages], async () => {
          for (const remoteMsg of remoteMessages) {
            const modTime =
              remoteMsg.updatedAt || remoteMsg.createdAt || 0;
            if (modTime >= batchLatestModTime) {
              batchLatestModTime = modTime;
              batchLastId = remoteMsg.id;
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
                  updatedAt: remoteMsg.updatedAt || remoteMsg.createdAt,
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

        // Without a server timestamp there is no safe cursor to store.
        if (batchLatestModTime <= 0) break;

        // On the initial page the ordering was createdAt, not the delta order.
        // Keep the cursor inclusive (no afterId) for one more pass so records
        // sharing that exact timestamp cannot be skipped.
        if (isInitialPage) {
          meta = { key: metaKey, lastSyncAt: batchLatestModTime };
        } else {
          if (
            batchLastId === previous?.afterId &&
            batchLatestModTime === previous?.lastSyncAt
          ) {
            // Server did not move forward; stop instead of looping forever.
            console.warn(
              `[SYNC] Cursor for channel ${channelId} did not advance; stopping.`
            );
            break;
          }

          meta = {
            key: metaKey,
            lastSyncAt: batchLatestModTime,
            afterId: batchLastId,
          };
        }

        await db.syncMeta.put(meta);
      }
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
    payload: OutboxOperation["payload"],
    userId?: string
  ): Promise<string> {
    const resolvedUid = resolveCurrentUserId(userId);

    // An operation without an owner can never be safely drained later.
    if (!resolvedUid) {
      throw new Error(
        "Cannot queue an outbox operation without an authenticated account."
      );
    }

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const op: OutboxOperation = {
      operationId,
      userId: resolvedUid,
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
      this.sync(channelId, resolvedUid).catch(() => {});
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
