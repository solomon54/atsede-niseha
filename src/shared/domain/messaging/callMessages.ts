// src/shared/domain/messaging/callMessages.ts
/**
 * Pure call-message artifact rules shared by the web backend and clients.
 *
 * A call lifecycle transition is only durable in chat when the message row is
 * complete and carries an `updatedAt` value that the delta-sync cursor can
 * observe. Partial `{ callDetails, editedAt }` writes leave a row that cannot
 * render as a CALL and never advances the sync cursor.
 */

export const RINGING_WINDOW_MS = 45_000;

export type CallLifecycleStatus =
  | "ringing"
  | "answered"
  | "declined"
  | "missed"
  | "cancelled"
  | "ended";

export interface CallMessageRecord {
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl?: string | null;
  callerRole?: string | null;
  status: CallLifecycleStatus;
  startedAt: number;
  answeredAt?: number | null;
  endedAt?: number | null;
  durationSec?: number | null;
  isGroup: boolean;
  notifiedRecipientIds?: string[];
  busyRecipientIds?: string[];
  updatedAt?: number;
  failureReason?: string | null;
}

export function isRingingStale(
  status: unknown,
  startedAt: unknown,
  now = Date.now()
): boolean {
  if (status !== "ringing") return false;
  const started = typeof startedAt === "number" ? startedAt : 0;
  if (!started) return true;
  return now - started > RINGING_WINDOW_MS;
}

/** Build the complete CALL ledger row, independent of Firestore or HTTP. */
export function buildCallMessageData(call: CallMessageRecord) {
  return {
    id: call.callId,
    channelId: call.channelId,
    senderId: call.callerId,
    senderName: call.callerName,
    senderRole: call.callerRole || null,
    type: "CALL" as const,
    content: call.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ",
    version: "v1" as const,
    isEncrypted: false,
    createdAt: call.startedAt,
    updatedAt: call.updatedAt || call.startedAt,
    callDetails: { ...call },
  };
}

/**
 * Complete merge patch for any call status transition. `updatedAt` is required:
 * `/api/message/list` delta sync orders by it, so `editedAt` alone is invisible
 * to clients whose cursor is already past the call's original start time.
 */
export function buildCallMessageUpdate(
  call: CallMessageRecord,
  now = Date.now()
) {
  return {
    ...buildCallMessageData(call),
    updatedAt: now,
    editedAt: now,
  };
}
