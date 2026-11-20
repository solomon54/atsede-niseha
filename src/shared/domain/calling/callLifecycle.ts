// src/shared/domain/calling/callLifecycle.ts

export type CallStatus =
  | "ringing"
  | "answered"
  | "declined"
  | "missed"
  | "cancelled"
  | "ended";

export type CallActorAction =
  | "join"
  | "answer"
  | "decline"
  | "end"
  | "cancel"
  | "timeout";

export interface CallActorRecord {
  callerId: string;
  notifiedRecipientIds?: string[] | null;
  busyRecipientIds?: string[] | null;
  status: CallStatus;
}

export interface CallActorDecision {
  allowed: boolean;
  reason?: "not_participant" | "caller_cannot_answer" | "invalid_status" | "forbidden_action";
}

export const TERMINAL_CALL_STATUSES: ReadonlySet<CallStatus> = new Set([
  "declined",
  "missed",
  "cancelled",
  "ended",
]);

export function isTerminalCallStatus(status: unknown): status is CallStatus {
  return typeof status === "string" && TERMINAL_CALL_STATUSES.has(status as CallStatus);
}

export function isJoinableCallStatus(status: unknown): status is "ringing" | "answered" {
  return status === "ringing" || status === "answered";
}

/**
 * Resolve the status that must actually be persisted when a call is terminated.
 * An answered call can only end as `ended` — never as missed/cancelled/declined.
 */
export function resolveTerminalStatus(
  callStatus: CallStatus,
  requested: Extract<CallStatus, "declined" | "missed" | "cancelled" | "ended">
): CallStatus {
  if (callStatus === "answered") return "ended";
  if (isTerminalCallStatus(callStatus)) return callStatus;
  if (callStatus !== "ringing") return "cancelled";

  switch (requested) {
    case "declined":
      return "declined";
    case "missed":
      return "missed";
    case "ended":
      return "ended";
    case "cancelled":
    default:
      return "cancelled";
  }
}

/** Caller and successfully notified recipients are the authoritative participants. */
export function getCallParticipantUids(call: CallActorRecord): string[] {
  return [
    call.callerId,
    ...(call.notifiedRecipientIds || []),
  ].filter((uid): uid is string => typeof uid === "string" && uid.length > 0);
}

export function isCallParticipant(call: CallActorRecord, uid: string | null | undefined): boolean {
  if (!uid) return false;
  return getCallParticipantUids(call).includes(uid);
}

/**
 * Pure authorization decision for call state transitions. Membership in the
 * chat channel is necessary but not sufficient: the actor must also be a
 * participant of this specific call and the action must fit its current state.
 */
export function canActorPerformCallAction(
  call: CallActorRecord,
  actorUid: string | null | undefined,
  action: CallActorAction
): CallActorDecision {
  if (!isCallParticipant(call, actorUid)) {
    return { allowed: false, reason: "not_participant" };
  }

  const uid = actorUid as string;
  const isCaller = uid === call.callerId;
  const isNotifiedRecipient = (call.notifiedRecipientIds || []).includes(uid);
  const active = isJoinableCallStatus(call.status);

  switch (action) {
    case "join":
      return active
        ? { allowed: true }
        : { allowed: false, reason: "invalid_status" };
    case "answer":
      if (isCaller) return { allowed: false, reason: "caller_cannot_answer" };
      if (!isNotifiedRecipient) return { allowed: false, reason: "not_participant" };
      if (call.status === "answered") return { allowed: true };
      return call.status === "ringing"
        ? { allowed: true }
        : { allowed: false, reason: "invalid_status" };
    case "decline":
      if (isCaller || !isNotifiedRecipient) {
        return { allowed: false, reason: "caller_cannot_answer" };
      }
      return call.status === "ringing"
        ? { allowed: true }
        : { allowed: false, reason: "invalid_status" };
    case "end":
      if (call.status === "answered") return { allowed: true };
      if (isCaller && call.status === "ringing") return { allowed: true };
      return { allowed: false, reason: "invalid_status" };
    case "cancel":
      return isCaller && call.status === "ringing"
        ? { allowed: true }
        : { allowed: false, reason: "forbidden_action" };
    case "timeout":
      return isCaller && call.status === "ringing"
        ? { allowed: true }
        : { allowed: false, reason: "forbidden_action" };
    default:
      return { allowed: false, reason: "forbidden_action" };
  }
}
