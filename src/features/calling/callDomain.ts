// src/features/calling/callDomain.ts

import { isTerminalCallStatus } from "@/shared/domain/calling/callLifecycle";
import { type CallRole,normalizeCallRole } from "@/shared/domain/calling/participantIdentity";

import type {
  ActiveCallState,
  CallIdentity,
  CallStatusResponse,
  CallTerminalStatus,
  IncomingCallPayload,
} from "./types";

export const RING_TIMEOUT_MS = 45_000;

export const TERMINAL_MESSAGES: Record<CallTerminalStatus, string> = {
  declined: "ጥሪው ተቀባይነት አላገኘም",
  missed: "ጥሪው አልተመለሰም",
  cancelled: "ጥሪው ተሰርዟል",
  ended: "ጥሪው ተጠናቋል",
  busy: "ተቀባዩ በሌላ ጥሪ ላይ ነው",
  unreachable: "ጥሪው ተቀባዩን አልደረሰም። እንደገና ይሞክሩ።",
  error: "ጥሪው ሊጠናቀቅ አልቻለም። እንደገና ይሞክሩ።",
};

export function terminalMessage(status: CallTerminalStatus): string {
  return TERMINAL_MESSAGES[status];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function terminalStatusFromLifecycle(status: unknown): CallTerminalStatus | null {
  if (isTerminalCallStatus(status)) return status as CallTerminalStatus;
  if (status === "busy" || status === "unreachable" || status === "error") return status;
  return null;
}

/** Extract the terminal status carried by a Pusher call/message event. */
export function terminalStatusFromEvent(
  event: string,
  data: unknown
): CallTerminalStatus | null {
  const record = asRecord(data);
  const details = asRecord(record?.callDetails);
  if (event === "call-declined") {
    return record?.status === "busy" ? "busy" : "declined";
  }
  if (event === "call-missed") return "missed";
  if (event === "call-ended") {
    return terminalStatusFromLifecycle(record?.status) || "ended";
  }
  if (event === "message-updated") {
    return terminalStatusFromLifecycle(details?.status ?? record?.status);
  }
  return null;
}

export function eventCallId(data: unknown): string | null {
  const record = asRecord(data);
  const details = asRecord(record?.callDetails);
  const id = record?.callId ?? record?.id ?? details?.callId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * A Pusher event may only end the UI call when it carries both a matching call
 * id and an authoritative terminal status. Non-terminal lifecycle updates —
 * especially `message-updated` with `status: "answered"` — must be ignored.
 */
export function resolveCallTerminalEvent(
  event: string,
  data: unknown
): { callId: string; status: CallTerminalStatus } | null {
  const callId = eventCallId(data);
  if (!callId) return null;
  const status = terminalStatusFromEvent(event, data);
  return status ? { callId, status } : null;
}

export function incomingIdentity(payload: IncomingCallPayload): CallIdentity {
  return {
    uid: payload.callerId,
    name: payload.callerName || "የንስሐ አባል",
    photoUrl: payload.callerPhotoUrl || null,
    role: normalizeCallRole(payload.callerRole),
  };
}

export function statusIdentity(status: CallStatusResponse): CallIdentity {
  return {
    uid: status.callerId,
    name: status.callerName || "የንስሐ አባል",
    photoUrl: status.callerPhotoUrl || null,
    role: normalizeCallRole(status.callerRole),
  };
}

/**
 * Never identify the signed-in user as the peer. For outgoing calls the peer
 * comes from the authoritative channel participant list; for incoming calls it
 * comes from the call record's caller fields.
 */
export function resolvePeer(args: {
  status: CallStatusResponse;
  currentUid: string | null;
  participants: Array<{ uid: string; displayName: string; photoUrl: string | null; role: unknown }>;
}): CallIdentity {
  const { status, currentUid, participants } = args;
  if (currentUid && status.callerId === currentUid) {
    const other = participants.find((p) => p.uid !== currentUid) || participants[0];
    if (other) {
      return {
        uid: other.uid,
        name: other.displayName,
        photoUrl: other.photoUrl || null,
        role: normalizeCallRole(other.role),
      };
    }
  }
  return statusIdentity(status);
}

export function toActiveCall(args: {
  status: CallStatusResponse;
  currentUid: string | null;
  participants: Array<{ uid: string; displayName: string; photoUrl: string | null; role: unknown }>;
}): ActiveCallState {
  const peer = resolvePeer(args);
  const { status } = args;
  const direction = args.currentUid && status.callerId === args.currentUid ? "outgoing" : "incoming";
  const phase = status.status === "answered" ? "answered" : direction === "outgoing" ? "outgoing" : "incoming";

  return {
    callId: status.callId,
    channelId: status.channelId,
    direction,
    phase,
    isGroup: status.isGroup,
    peer,
    participants: {
      [peer.uid]: peer,
      ...(args.currentUid
        ? {
            [args.currentUid]: {
              uid: args.currentUid,
              name: "እርስዎ",
              photoUrl: null,
              role: "STUDENT" as CallRole,
            },
          }
        : {}),
    },
    startedAt: status.startedAt || Date.now(),
    answeredAt: status.answeredAt || null,
    terminal: null,
  };
}

export function formatCallDuration(from: number | null, now = Date.now()): string {
  if (!from) return "00:00";
  const total = Math.max(0, Math.floor((now - from) / 1000));
  const mins = Math.floor(total / 60).toString().padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function callRouteFor(call: Pick<ActiveCallState, "channelId" | "callId">): string {
  return `/call/${encodeURIComponent(call.channelId)}?callId=${encodeURIComponent(call.callId)}`;
}
