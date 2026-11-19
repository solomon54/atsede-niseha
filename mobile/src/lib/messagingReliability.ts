// mobile/src/lib/messagingReliability.ts
/**
 * Pure, dependency-free helpers for Android messaging reliability.
 *
 * These helpers define the account boundary for conversation state and the
 * context of a sync cycle. Keeping them pure lets the rules be regression
 * tested without importing React Native, Expo, SQLite, or Pusher.
 */

export interface SyncContext {
  uid: string;
  channelId: string;
}

function normalized(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** SQLite snapshot key for one account's conversation list. */
export function conversationCacheKey(uid: string | null | undefined): string | null {
  const owner = normalized(uid);
  return owner ? `conversations:${owner}` : null;
}

/** React Query key for one account's conversation list. */
export function conversationQueryKey(
  uid: string | null | undefined
): readonly ["conversations", string] {
  return ["conversations", normalized(uid) || "anonymous"] as const;
}

/** React Query key for one account's view of a room's messages. */
export function messageQueryKey(
  uid: string | null | undefined,
  channelId: string
): readonly ["messages", string, string] {
  return ["messages", normalized(uid) || "anonymous", normalized(channelId)] as const;
}

export function toSyncContext(
  activeChannelId?: string,
  currentUserId?: string
): SyncContext {
  return {
    uid: normalized(currentUserId),
    channelId: normalized(activeChannelId),
  };
}

export function isSameSyncContext(a: SyncContext, b: SyncContext): boolean {
  return a.uid === b.uid && a.channelId === b.channelId;
}

interface MessagePreview {
  isEncrypted?: boolean;
  content?: string;
  decryptedPreview?: string;
}

interface PreviewConversation {
  lastMessage?: MessagePreview | null;
}

/** Visible previews must never retain ciphertext. */
export function sanitizeMessagePreview(
  lastMessage: MessagePreview
): string | undefined {
  if (lastMessage.isEncrypted !== true) return lastMessage.content;
  return typeof lastMessage.decryptedPreview === "string"
    ? lastMessage.decryptedPreview
    : "";
}

/**
 * Replace ciphertext in a visible preview with the decrypted preview when one
 * is available, otherwise with an empty string. Room metadata is preserved.
 */
export function sanitizeConversationPreviews<T extends PreviewConversation>(
  conversations: T[]
): T[] {
  return conversations.map((conversation) => {
    const lastMessage = conversation.lastMessage;
    if (!lastMessage || lastMessage.isEncrypted !== true) return conversation;
    return {
      ...conversation,
      lastMessage: {
        ...lastMessage,
        content: sanitizeMessagePreview(lastMessage) ?? "",
      },
    } as T;
  });
}
