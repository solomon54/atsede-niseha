import { offlineCache, SQLiteOutboxItem } from "./cache";
import { apiRequest, apiUpload } from "./api";
import { getMobilePusher } from "./pusher";

let activeSyncPromise: Promise<void> | null = null;
let pusherConnected = false;

/**
 * Recovery listeners are registered once per Pusher connection. The signed-in
 * account is read at event time so a re-login or account switch never reuses a
 * stale closure, and the owning view can remove the handlers on logout.
 */
type RealtimeRecoveryHandlers = {
  connected: () => void;
  disconnected: () => void;
  error: () => void;
};

let recoveryConnection: any = null;
let recoveryHandlers: RealtimeRecoveryHandlers | null = null;
let recoveryUserId: string | undefined;

export const mobileSyncService = {
  /**
   * Single-flight coordinator for mobile synchronization.
   */
  async sync(activeChannelId?: string, currentUserId?: string): Promise<void> {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = this.executeSync(activeChannelId, currentUserId).finally(() => {
      activeSyncPromise = null;
    });

    return activeSyncPromise;
  },

  async executeSync(activeChannelId?: string, currentUserId?: string): Promise<void> {
    try {
      // 1. Drain pending outbox operations first (account-isolated)
      await this.drainOutbox(currentUserId);

      // 2. Refresh conversation list into SQLite
      await this.syncConversations();

      // 3. If an active channel is open, sync delta messages
      if (activeChannelId) {
        await this.syncChannelMessages(activeChannelId);
      }
    } catch (e) {
      console.warn("[MobileSync] Sync cycle warning:", e);
    }
  },

  /**
   * Drain pending outbox items in FIFO order
   */
  async drainOutbox(currentUserId?: string): Promise<void> {
    // Without an authenticated owner we must not touch the queue at all.
    if (!currentUserId) return;

    const pending = await offlineCache.getPendingOutbox(currentUserId);
    if (pending.length === 0) return;

    for (const op of pending) {
      // Defence in depth: the query is already account-scoped.
      if (op.userId !== currentUserId) continue;

      try {
        if (op.type === "SEND_MESSAGE") {
          let media = op.payload.media;

          // If staged media file needs upload first
          if (op.payload._stagedFile) {
            const staged = op.payload._stagedFile;
            const formData = new FormData();
            formData.append("file", {
              uri: staged.uri,
              name: staged.name,
              type: staged.type,
            } as any);
            formData.append("channelId", op.channelId);

            const uploadRes = await apiUpload<{ ok: boolean; media: any }>(
              "/api/message/chat-media-upload",
              formData
            );
            if (uploadRes?.ok && uploadRes.media) {
              media = { ...uploadRes.media, originalName: staged.name };
              // PERSIST media upload result in outbox immediately so a restart will not re-upload
              op.payload.media = media;
              delete op.payload._stagedFile;
              await offlineCache.updateOutboxPayload(
                op.operationId,
                op.payload
              );
            }
          }

          const res = await apiRequest<{ success: boolean; messageId: string }>(
            "/api/message/send",
            {
              method: "POST",
              body: JSON.stringify({
                channelId: op.channelId,
                content: op.payload.content,
                type: op.payload.type,
                media,
                isEncrypted: op.payload.isEncrypted,
                encryption: op.payload.encryption,
                clientMessageId: op.payload.clientMessageId,
                replyTo: op.payload.replyTo,
              }),
            }
          );

          if (res?.success) {
            await offlineCache.removeOutbox(op.operationId);
            if (op.payload.clientMessageId) {
              const clientId = op.payload.clientMessageId;
              const serverId = res.messageId;
              if (serverId && serverId !== clientId) {
                await offlineCache.replaceMessageId(
                  op.channelId,
                  clientId,
                  serverId
                );
              } else {
                await offlineCache.updateMessage(
                  op.channelId,
                  clientId,
                  (msg) => ({
                    ...msg,
                    status: "SENT",
                  })
                );
              }
            }
          }
        } else if (op.type === "EDIT_MESSAGE") {
          const res = await apiRequest<{ success: boolean }>("/api/message/edit", {
            method: "POST",
            body: JSON.stringify(op.payload),
          });
          if (res?.success) {
            await offlineCache.removeOutbox(op.operationId);
          }
        } else if (op.type === "DELETE_MESSAGE") {
          const res = await apiRequest<{ success: boolean }>("/api/message/delete", {
            method: "POST",
            body: JSON.stringify(op.payload),
          });
          if (res?.success) {
            await offlineCache.removeOutbox(op.operationId);
          }
        } else if (op.type === "MARK_READ") {
          await apiRequest("/api/message/read", {
            method: "POST",
            body: JSON.stringify(op.payload),
          });
          await offlineCache.removeOutbox(op.operationId);
        }
      } catch (err) {
        console.warn(`[MobileSync] Outbox operation ${op.operationId} paused:`, err);
        break; // Network or server issue; pause queue until next window
      }
    }
  },

  /**
   * Sync conversations into SQLite query_cache
   */
  async syncConversations(): Promise<any[]> {
    try {
      const res = await apiRequest<any[]>("/api/message/conversation");
      if (Array.isArray(res)) {
        // Never cache ciphertext in visible preview fields.
        const safe = res.map((c: any) => ({
          ...c,
          lastMessage: c?.lastMessage
            ? {
                ...c.lastMessage,
                content:
                  c.lastMessage.isEncrypted === true
                    ? (typeof c.lastMessage.decryptedPreview === "string" ? c.lastMessage.decryptedPreview : "")
                    : c.lastMessage.content,
              }
            : c?.lastMessage ?? null,
        }));
        await offlineCache.setQuery("conversations", safe);
        return safe;
      }
      return [];
    } catch {
      return (await offlineCache.getQuery<any[]>("conversations")) || [];
    }
  },

  /**
   * Delta sync channel messages using cursors
   * - Never advances cursor with Date.now()
   * - Loops while a batch is full
   * - Supports tiebreaker pagination via afterId
   * - Commits cursor strictly after writes succeed
   */
  async syncChannelMessages(channelId: string): Promise<any[]> {
    try {
      const metaKey = `channel_${channelId}`;
      let cursor = await offlineCache.getSyncCursor(metaKey);
      let hasMore = true;
      let pageCount = 0;
      const PAGE_LIMIT = 30;
      const MAX_PAGES = 200;

      while (hasMore) {
        if (pageCount >= MAX_PAGES) {
          console.warn(
            `[MobileSync] Delta sync for ${channelId} stopped after ${MAX_PAGES} pages.`
          );
          break;
        }
        pageCount += 1;

        const previous = cursor;
        const isInitialPage = !previous.lastSyncAt;
        const params = new URLSearchParams();
        params.set("channelId", channelId);
        params.set("limit", String(PAGE_LIMIT));
        if (previous.lastSyncAt) {
          params.set("since", String(previous.lastSyncAt));
        }
        if (previous.afterId) {
          params.set("afterId", previous.afterId);
        }

        const remoteMessages = await apiRequest<any[]>(
          `/api/message/list?${params.toString()}`
        );

        if (!Array.isArray(remoteMessages) || remoteMessages.length === 0) {
          hasMore = false;
          break;
        }

        hasMore = remoteMessages.length >= PAGE_LIMIT;

        let batchLatestModTime = previous.lastSyncAt || 0;
        let batchLastId = previous.afterId;

        for (const msg of remoteMessages) {
          const modTime = msg.updatedAt || msg.createdAt || 0;
          if (modTime >= batchLatestModTime) {
            batchLatestModTime = modTime;
            batchLastId = msg.id;
          }

          if (msg.deletedAt) {
            await offlineCache.updateMessageStrict(channelId, msg.id, (m) => ({
              ...m,
              deletedAt: msg.deletedAt,
              content: "",
              media: null,
              updatedAt: msg.updatedAt || msg.createdAt,
            }));
          } else {
            await offlineCache.saveMessagesStrict(channelId, [
              { ...msg, status: "SENT" },
            ]);
          }
        }

        // A cursor can only be built from server timestamps.
        if (!batchLatestModTime) break;

        // The first page was ordered by createdAt, so keep the cursor
        // inclusive for one pass to include every row sharing the timestamp.
        if (isInitialPage) {
          cursor = { lastSyncAt: batchLatestModTime };
        } else {
          if (
            batchLastId === previous.afterId &&
            batchLatestModTime === previous.lastSyncAt
          ) {
            console.warn(
              `[MobileSync] Cursor for ${channelId} did not advance; stopping.`
            );
            break;
          }

          cursor = {
            lastSyncAt: batchLatestModTime,
            afterId: batchLastId,
          };
        }

        // Throws if the cursor could not be committed, allowing the next run
        // to safely re-fetch the same idempotent batch.
        await offlineCache.setSyncCursorStrict(
          metaKey,
          cursor.lastSyncAt,
          cursor.afterId
        );
      }

      return await offlineCache.getMessages(channelId);
    } catch (e) {
      console.warn(`[MobileSync] Message sync for ${channelId} failed:`, e);
      return await offlineCache.getMessages(channelId);
    }
  },

  /**
   * Initialize Pusher reconnect listener for auto-healing missed events.
   * Idempotent: repeated calls update the account context but never bind the
   * same connection twice, and handlers read the current account at event time.
   */
  initRealtimeRecovery(currentUserId?: string) {
    try {
      const pusher = getMobilePusher();

      if (recoveryConnection === pusher.connection && recoveryHandlers) {
        recoveryUserId = currentUserId;
        return;
      }

      // A previous connection (or a partially bound one) must be cleaned
      // before new handlers are attached.
      this.teardownRealtimeRecovery();
      recoveryUserId = currentUserId;

      const handlers: RealtimeRecoveryHandlers = {
        connected: () => {
          if (!pusherConnected) {
            pusherConnected = true;
            // Read the account at event time rather than capturing a closure
            // that could outlive the session that registered it.
            this.sync(undefined, recoveryUserId).catch(() => {});
          }
        },
        disconnected: () => {
          pusherConnected = false;
        },
        error: () => {
          pusherConnected = false;
        },
      };

      pusher.connection.bind("connected", handlers.connected);
      pusher.connection.bind("disconnected", handlers.disconnected);
      pusher.connection.bind("error", handlers.error);

      recoveryConnection = pusher.connection;
      recoveryHandlers = handlers;
    } catch (e) {
      console.warn("[MobileSync] Realtime recovery setup failed:", e);
    }
  },

  /**
   * Remove recovery handlers and forget the account context. Called when the
   * authenticated session changes (logout/account switch) or its owning view
   * unmounts. Safe to call repeatedly; never disconnects or replaces the
   * shared Pusher client.
   */
  teardownRealtimeRecovery() {
    const connection = recoveryConnection;
    const handlers = recoveryHandlers;

    recoveryConnection = null;
    recoveryHandlers = null;
    recoveryUserId = undefined;
    pusherConnected = false;

    if (!connection || !handlers) return;

    try {
      connection.unbind("connected", handlers.connected);
      connection.unbind("disconnected", handlers.disconnected);
      connection.unbind("error", handlers.error);
    } catch {
      // A destroyed connection needs no cleanup.
    }
  },
};

