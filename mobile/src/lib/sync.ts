import { offlineCache, SQLiteOutboxItem } from "./cache";
import { apiRequest, apiUpload } from "./api";
import { getMobilePusher } from "./pusher";

let activeSyncPromise: Promise<void> | null = null;
let pusherConnected = false;

export const mobileSyncService = {
  /**
   * Single-flight coordinator for mobile synchronization.
   */
  async sync(activeChannelId?: string): Promise<void> {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = this.executeSync(activeChannelId).finally(() => {
      activeSyncPromise = null;
    });

    return activeSyncPromise;
  },

  async executeSync(activeChannelId?: string): Promise<void> {
    try {
      // 1. Drain pending outbox operations first
      await this.drainOutbox();

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
  async drainOutbox(): Promise<void> {
    const pending = await offlineCache.getPendingOutbox();
    if (pending.length === 0) return;

    for (const op of pending) {
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
              await offlineCache.updateMessage(
                op.channelId,
                op.payload.clientMessageId,
                (msg) => ({
                  ...msg,
                  id: res.messageId || msg.id,
                  status: "SENT",
                })
              );
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
        await offlineCache.setQuery("conversations", res);
        await offlineCache.setSyncCursor("conversations", Date.now());
        return res;
      }
      return [];
    } catch {
      return (await offlineCache.getQuery<any[]>("conversations")) || [];
    }
  },

  /**
   * Delta sync channel messages using cursors
   */
  async syncChannelMessages(channelId: string): Promise<any[]> {
    try {
      const metaKey = `channel_${channelId}`;
      const lastSyncAt = await offlineCache.getSyncCursor(metaKey);
      const sinceQuery = lastSyncAt ? `&since=${lastSyncAt}` : "&limit=30";

      const remoteMessages = await apiRequest<any[]>(
        `/api/message/list?channelId=${channelId}${sinceQuery}`
      );

      if (Array.isArray(remoteMessages) && remoteMessages.length > 0) {
        let latestModTime = lastSyncAt;

        for (const msg of remoteMessages) {
          const modTime = msg.updatedAt || msg.createdAt || Date.now();
          if (modTime > latestModTime) {
            latestModTime = modTime;
          }

          if (msg.deletedAt) {
            await offlineCache.updateMessage(channelId, msg.id, (m) => ({
              ...m,
              deletedAt: msg.deletedAt,
              content: "",
              media: null,
            }));
          } else {
            await offlineCache.saveMessages(channelId, [{ ...msg, status: "SENT" }]);
          }
        }

        await offlineCache.setSyncCursor(
          metaKey,
          Math.max(latestModTime, Date.now() - 1000)
        );
      } else {
        await offlineCache.setSyncCursor(metaKey, Date.now());
      }

      return await offlineCache.getMessages(channelId);
    } catch (e) {
      console.warn(`[MobileSync] Message sync for ${channelId} failed:`, e);
      return await offlineCache.getMessages(channelId);
    }
  },

  /**
   * Initialize Pusher reconnect listener for auto-healing missed events
   */
  initRealtimeRecovery() {
    try {
      const pusher = getMobilePusher();
      pusher.connection.bind("connected", () => {
        if (!pusherConnected) {
          pusherConnected = true;
          this.sync().catch(() => {});
        }
      });
      pusher.connection.bind("disconnected", () => {
        pusherConnected = false;
      });
      pusher.connection.bind("error", () => {
        pusherConnected = false;
      });
    } catch (e) {
      console.warn("[MobileSync] Realtime recovery setup failed:", e);
    }
  },
};

