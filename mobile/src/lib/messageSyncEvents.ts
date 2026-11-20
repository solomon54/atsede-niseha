// mobile/src/lib/messageSyncEvents.ts
/**
 * Small channel-scoped notification bus for completed persisted-message syncs.
 *
 * The sync service writes to SQLite; mounted React Query views must be told
 * that new rows are available even when the sync was triggered by AppState,
 * network recovery, or a Pusher reconnect rather than by the view's own query.
 * The owner uid travels with each event so a view can ignore a late sync from
 * a previous account.
 */

export type MessageSyncListener<T = any> = (
  channelId: string,
  messages: T[],
  ownerUid?: string
) => void;

export function createMessageSyncNotifier<T = any>() {
  const listeners = new Set<MessageSyncListener<T>>();

  return {
    subscribe(listener: MessageSyncListener<T>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    notify(channelId: string, messages: T[], ownerUid?: string): void {
      if (!channelId) return;
      for (const listener of [...listeners]) {
        try {
          listener(channelId, messages, ownerUid);
        } catch (error) {
          // One broken subscriber must not prevent other views from updating.
          console.warn("[MessageSync] Listener failed:", error);
        }
      }
    },
  };
}

export const messageSyncNotifier = createMessageSyncNotifier<any>();
