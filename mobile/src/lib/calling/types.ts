export type CallDirection = "incoming" | "outgoing";
export type CallUiStatus = "incoming" | "ringing" | "answered" | "ended";
export type CallTerminalStatus =
  | "ended"
  | "declined"
  | "missed"
  | "cancelled"
  | "busy"
  | "unreachable";

export interface CallPeer {
  uid?: string;
  name: string;
  role: string;
  photoUrl?: string | null;
}

export interface CallTokenResponse {
  success: boolean;
  token: string;
  url: string;
  roomName: string;
  callId?: string | null;
  maxParticipants: number;
  participantName: string;
  participantPhotoUrl?: string | null;
  participantRole?: string;
  participants?: CallPeer[];
}

export interface CallTerminalInfo {
  status: CallTerminalStatus;
  message: string;
}

export interface ActiveCallState {
  callId: string;
  channelId: string;
  direction: CallDirection;
  status: CallUiStatus;
  peer: CallPeer;
  isGroup: boolean;
  startedAt: number;
  answeredAt?: number | null;
  participants: Record<string, CallPeer>;
  token?: CallTokenResponse | null;
  terminal?: CallTerminalInfo | null;
  transitioning?: boolean;
}

export interface IncomingCallPayload {
  callId: string;
  channelId: string;
  callerId?: string;
  callerName: string;
  callerPhotoUrl?: string | null;
  callerRole?: string;
  isGroup: boolean;
  startedAt?: number;
}

export function normalizeCallRole(role?: string | null): string {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "FATHER" || normalized === "STUDENT" || normalized === "GOVERNOR" || normalized === "CHILD") {
    return normalized;
  }
  return "STUDENT";
}

export function callRoleLabel(role?: string | null): string {
  switch (normalizeCallRole(role)) {
    case "FATHER":
      return "የንስሐ አባት";
    case "GOVERNOR":
      return "የንስሐ ገዥ";
    case "CHILD":
    case "STUDENT":
    default:
      return "የንስሐ ልጅ";
  }
}

export function toIncomingPayload(
  data: Record<string, unknown>
): IncomingCallPayload | null {
  const channelId = typeof data.channelId === "string" ? data.channelId : "";
  const callId = typeof data.callId === "string" ? data.callId : "";
  if (!channelId || !callId) return null;

  return {
    callId,
    channelId,
    callerId: typeof data.callerId === "string" ? data.callerId : undefined,
    callerName:
      typeof data.callerName === "string" && data.callerName
        ? data.callerName
        : "የንስሐ አባል",
    callerPhotoUrl:
      typeof data.callerPhotoUrl === "string" ? data.callerPhotoUrl : null,
    callerRole: typeof data.callerRole === "string" ? data.callerRole : "STUDENT",
    isGroup: data.isGroup === true || data.isGroup === "true",
    startedAt:
      typeof data.startedAt === "number"
        ? data.startedAt
        : typeof data.startedAt === "string"
        ? Number(data.startedAt) || Date.now()
        : Date.now(),
  };
}

export function toPeerFromIncoming(payload: IncomingCallPayload): CallPeer {
  return {
    uid: payload.callerId,
    name: payload.callerName,
    role: payload.callerRole || "STUDENT",
    photoUrl: payload.callerPhotoUrl || null,
  };
}

export function terminalMessage(
  status: CallTerminalStatus,
  busy?: boolean
): string {
  switch (status) {
    case "declined":
      return "ጥሪው ተቀባይነት አላገኘም";
    case "missed":
      return "ጥሪው አልተመለሰም";
    case "cancelled":
      return "ጥሪው ተሰርዟል";
    case "busy":
      return busy
        ? "ተቀባዩ በሌላ ጥሪ ላይ ነው"
        : "በሌላ ጥሪ ላይ ነዎት";
    case "unreachable":
      return "ጥሪው ተቀባዩን አልደረሰም። እባክዎ እንደገና ይሞክሩ።";
    case "ended":
    default:
      return "ጥሪው ተጠናቋል";
  }
}
