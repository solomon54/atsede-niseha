// src/features/calling/types.ts

import type { CallRole } from "@/shared/domain/calling/participantIdentity";

export type CallDirection = "incoming" | "outgoing";
export type CallPhase = "incoming" | "outgoing" | "answered" | "terminal";
export type CallTerminalStatus =
  | "declined"
  | "missed"
  | "cancelled"
  | "ended"
  | "busy"
  | "unreachable"
  | "error";

export interface CallIdentity {
  uid: string;
  name: string;
  photoUrl: string | null;
  role: CallRole;
}

export interface IncomingCallPayload {
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl?: string | null;
  callerRole?: string | null;
  isGroup: boolean;
  startedAt: number;
}

export interface ActiveCallState {
  callId: string;
  channelId: string;
  direction: CallDirection;
  phase: CallPhase;
  isGroup: boolean;
  peer: CallIdentity;
  participants: Record<string, CallIdentity>;
  startedAt: number;
  answeredAt: number | null;
  terminal: { status: CallTerminalStatus; message: string } | null;
}

export interface CallParticipantView {
  identity: string;
  name: string;
  role: CallRole | null;
  photoUrl: string | null;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isSpeaking: boolean;
  videoTrack: import("livekit-client").VideoTrack | null;
  audioTrack: import("livekit-client").AudioTrack | null;
}

export interface CallStatusResponse {
  callId: string;
  channelId: string;
  status: string;
  joinable: boolean;
  callerId: string;
  callerName: string | null;
  callerPhotoUrl: string | null;
  callerRole: string | null;
  isGroup: boolean;
  startedAt: number | null;
  answeredAt: number | null;
}

export interface CallTokenResponse {
  success: boolean;
  token: string;
  url: string;
  participantName: string;
  participantPhotoUrl: string | null;
  participantRole: CallRole;
  participants: Array<{
    uid: string;
    displayName: string;
    photoUrl: string | null;
    role: CallRole;
  }>;
}
