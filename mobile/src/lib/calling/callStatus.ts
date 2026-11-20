import {
  CallTerminalStatus,
  IncomingCallPayload,
} from "./types";

export interface CallStatusResponse {
  callId?: string | null;
  channelId?: string | null;
  status?: string | null;
  rawStatus?: string | null;
  stale?: boolean;
  joinable?: boolean;
  callerId?: string | null;
  callerName?: string | null;
  callerPhotoUrl?: string | null;
  callerRole?: string | null;
  isGroup?: boolean;
  startedAt?: number | string | null;
  answeredAt?: number | string | null;
  endedAt?: number | string | null;
  durationSec?: number | null;
}

export interface CallStatusTarget {
  callId: string;
  channelId: string;
}

export type CallStatusDecision =
  | { kind: "ring"; response: CallStatusResponse }
  | { kind: "resume"; response: CallStatusResponse }
  | { kind: "terminal"; status: CallTerminalStatus; response: CallStatusResponse }
  | {
      kind: "invalid";
      reason: "malformed" | "mismatch" | "missing" | "unauthorized" | "not-joinable";
    }
  | { kind: "unavailable" };

const TERMINAL_STATUS_MAP: Record<string, CallTerminalStatus> = {
  ended: "ended",
  declined: "declined",
  missed: "missed",
  cancelled: "cancelled",
  busy: "busy",
  unreachable: "unreachable",
  timeout: "missed",
  timedout: "missed",
  "timed-out": "missed",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizedStatus(response: CallStatusResponse): string {
  return text(response.status || response.rawStatus).toLowerCase();
}

export function terminalStatusFromStatus(status: unknown): CallTerminalStatus | null {
  if (typeof status !== "string") return null;
  return TERMINAL_STATUS_MAP[status.trim().toLowerCase()] || null;
}

export function buildStatusQuery(target: CallStatusTarget): string {
  return [
    `callId=${encodeURIComponent(target.callId)}`,
    `channelId=${encodeURIComponent(target.channelId)}`,
  ].join("&");
}

export function classifyCallStatus(
  response: CallStatusResponse | null | undefined,
  expected?: Partial<CallStatusTarget>
): CallStatusDecision {
  if (!response || typeof response !== "object") {
    return { kind: "invalid", reason: "malformed" };
  }

  const callId = text(response.callId);
  const channelId = text(response.channelId);
  if (!callId || !channelId) {
    return { kind: "invalid", reason: "malformed" };
  }
  if (expected?.callId && callId !== expected.callId) {
    return { kind: "invalid", reason: "mismatch" };
  }
  if (expected?.channelId && channelId !== expected.channelId) {
    return { kind: "invalid", reason: "mismatch" };
  }

  const status = normalizedStatus(response);
  const terminal = terminalStatusFromStatus(status);

  // /api/livekit/status self-heals a stale ringing record on read. Treat the
  // reconciled response as terminal even if a proxy cached an older status.
  if (response.stale === true) {
    return { kind: "terminal", status: terminal || "missed", response };
  }
  if (terminal) {
    return { kind: "terminal", status: terminal, response };
  }
  if ((status === "ringing" || status === "answered") && response.joinable === false) {
    return { kind: "invalid", reason: "not-joinable" };
  }
  if (joinableStatus(response, status) === "ringing") {
    return { kind: "ring", response };
  }
  if (joinableStatus(response, status) === "answered") {
    return { kind: "resume", response };
  }

  return { kind: "invalid", reason: "malformed" };
}

function joinableStatus(
  response: CallStatusResponse,
  status: string
): "ringing" | "answered" | null {
  if (status !== "ringing" && status !== "answered") return null;
  if (response.joinable === false) return null;
  return status;
}

export function classifyStatusError(error: unknown): CallStatusDecision {
  const status = Number((error as { status?: unknown } | null)?.status);
  if (status === 401 || status === 403) {
    return { kind: "invalid", reason: "unauthorized" };
  }
  if (status === 404) {
    return { kind: "invalid", reason: "missing" };
  }
  if (status === 400) {
    return { kind: "invalid", reason: "malformed" };
  }
  // A network/5xx failure is retryable. Keep local presentation untouched and
  // let foreground, Pusher reconnect, or NetInfo recovery validate again.
  return { kind: "unavailable" };
}

export function incomingPayloadFromStatus(
  response: CallStatusResponse,
  fallback?: IncomingCallPayload | null
): IncomingCallPayload | null {
  const callId = text(response.callId) || text(fallback?.callId);
  const channelId = text(response.channelId) || text(fallback?.channelId);
  if (!callId || !channelId) return null;

  return {
    callId,
    channelId,
    callerId: text(response.callerId) || fallback?.callerId || undefined,
    callerName:
      text(response.callerName) || fallback?.callerName || "የንስሐ አባል",
    callerPhotoUrl:
      response.callerPhotoUrl !== undefined
        ? response.callerPhotoUrl || null
        : fallback?.callerPhotoUrl || null,
    callerRole:
      text(response.callerRole) || fallback?.callerRole || "STUDENT",
    isGroup:
      typeof response.isGroup === "boolean"
        ? response.isGroup
        : fallback?.isGroup ?? false,
    startedAt:
      numeric(response.startedAt) ?? fallback?.startedAt ?? undefined,
  };
}

export function statusTimestamp(
  response: CallStatusResponse,
  field: "startedAt" | "answeredAt"
): number | undefined {
  return numeric(response[field]);
}

export function canPresentIncoming(
  payload: IncomingCallPayload,
  current: { callId: string; status: string } | null,
  terminalCallIds: ReadonlySet<string>
): boolean {
  if (!payload.callId || !payload.channelId) return false;
  if (terminalCallIds.has(payload.callId)) return false;
  if (
    current &&
    current.callId &&
    current.callId !== payload.callId &&
    current.status !== "ended"
  ) {
    return false;
  }
  return true;
}

export function shouldApplyEvent(
  eventCallId: string | null | undefined,
  current: { callId: string; status: string } | null
): boolean {
  const callId = text(eventCallId);
  if (!callId) return false;
  if (!current || current.status === "ended") return false;
  return current.callId === callId;
}
