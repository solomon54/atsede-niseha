// src/shared/domain/messaging/syncFeedback.ts
/**
 * Pure message delivery feedback shared by Web and Android.
 *
 * Local optimistic status and outbox status are interpreted for display only.
 * Queue state, retry ordering, and idempotency remain unchanged.
 */

export type MessageLocalStatus = "pending" | "sending" | "sent" | "error";
export type MessageOutboxStatus = "pending" | "sending" | "failed";

export type MessageDeliveryState =
  | "confirmed"
  | "sending"
  | "queued"
  | "rejected"
  | "error";

export interface MessageDeliveryFeedback {
  state: MessageDeliveryState;
  label: string;
  detail?: string;
  /** True when an outbox row still owns this message. */
  outboxManaged: boolean;
}

export interface MessageDeliveryFeedbackInput {
  localStatus?: MessageLocalStatus | string;
  outboxStatus?: MessageOutboxStatus | string;
  outboxError?: string;
  localError?: string;
  isOnline?: boolean;
}

export const MESSAGE_SYNC_TERMS = {
  confirmed: "ተልኳል",
  sending: "በመላክ ላይ",
  queuedOffline: "በመስመር ውጭ ተቀምጧል",
  queuedWaiting: "ለማመሳሰል በመጠበቅ ላይ",
  rejected: "መልእክቱ ውድቅ ተደርጓል",
  rejectedDetail: "አገልጋይ መልእክቱን አልተቀበለም።",
  error: "መላክ አልተሳካም",
  retry: "እንደገና ሞክር",
} as const;

function normalizeStatus(status?: string): string | undefined {
  return status?.trim().toLowerCase();
}

/**
 * Derive an honest delivery state. An outbox row always wins over the local
 * optimistic status: a locally failed send with a pending row is still queued,
 * not confirmed and not failed.
 */
export function getMessageDeliveryFeedback(
  input: MessageDeliveryFeedbackInput
): MessageDeliveryFeedback {
  const {
    localStatus,
    outboxStatus,
    outboxError,
    localError,
    isOnline = true,
  } = input;
  const local = normalizeStatus(localStatus);
  const outbox = normalizeStatus(outboxStatus);

  if (outbox === "failed") {
    return {
      state: "rejected",
      label: MESSAGE_SYNC_TERMS.rejected,
      detail: outboxError || MESSAGE_SYNC_TERMS.rejectedDetail,
      outboxManaged: true,
    };
  }

  if (outbox === "pending" || outbox === "sending") {
    return {
      state: "queued",
      label: isOnline
        ? MESSAGE_SYNC_TERMS.queuedWaiting
        : MESSAGE_SYNC_TERMS.queuedOffline,
      detail: isOnline
        ? "መልእክቱ በአገልጋይ ላይ ገና አልተመዘገበም።"
        : "መልእክቱ ሲገናኙ ይላካል፤ በአገልጋይ ላይ ገና አልተመዘገበም።",
      outboxManaged: true,
    };
  }

  if (local === "error" || local === "failed") {
    return {
      state: "error",
      label: MESSAGE_SYNC_TERMS.error,
      detail: localError,
      outboxManaged: false,
    };
  }

  if (local === "sending") {
    return {
      state: "sending",
      label: MESSAGE_SYNC_TERMS.sending,
      outboxManaged: false,
    };
  }

  if (local === "pending") {
    return {
      state: "queued",
      label: isOnline
        ? MESSAGE_SYNC_TERMS.queuedWaiting
        : MESSAGE_SYNC_TERMS.queuedOffline,
      detail: isOnline
        ? "መልእክቱ በአገልጋይ ላይ ገና አልተመዘገበም።"
        : "መልእክቱ ሲገናኙ ይላካል፤ በአገልጋይ ላይ ገና አልተመዘገበም።",
      outboxManaged: false,
    };
  }

  return {
    state: "confirmed",
    label: MESSAGE_SYNC_TERMS.confirmed,
    outboxManaged: false,
  };
}
