// src/shared/domain/calling/notificationPayload.ts

export const INCOMING_CALL_CATEGORY_ID = "incoming_call";

export interface IncomingCallNotificationData extends Record<string, string> {
  type: "incoming_call";
  categoryId: typeof INCOMING_CALL_CATEGORY_ID;
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl: string;
  callerRole: string;
  isGroup: "true" | "false";
  startedAt: string;
}

/** All FCM data values must be strings. Keep this shape shared by native + JS handlers. */
export function buildIncomingCallNotificationData(args: {
  callId: string;
  channelId: string;
  callerId: string;
  callerName: string;
  callerPhotoUrl?: string | null;
  callerRole: string;
  isGroup: boolean;
  startedAt: number;
}): IncomingCallNotificationData {
  return {
    type: "incoming_call",
    categoryId: INCOMING_CALL_CATEGORY_ID,
    callId: String(args.callId),
    channelId: String(args.channelId),
    callerId: String(args.callerId),
    callerName: String(args.callerName),
    callerPhotoUrl: String(args.callerPhotoUrl || ""),
    callerRole: String(args.callerRole),
    isGroup: args.isGroup ? "true" : "false",
    startedAt: String(args.startedAt),
  };
}
