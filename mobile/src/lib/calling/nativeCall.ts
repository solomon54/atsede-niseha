import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

import { IncomingCallPayload } from "./types";

const Native = (NativeModules as any).CallNotificationModule;

export const NATIVE_CALL_EVENTS = {
  incoming: "CallIncoming",
  answer: "CallAnswer",
  decline: "CallDecline",
  hangup: "CallHangup",
  stopped: "CallStopped",
} as const;

export type NativeCallAction = "answer" | "decline" | "hangup";

export interface NativeCallIntent {
  action: NativeCallAction | "incoming";
  payload: IncomingCallPayload | null;
}

function parsePayload(raw: unknown): IncomingCallPayload | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as IncomingCallPayload;
    } catch {
      return null;
    }
  }
  return raw as IncomingCallPayload;
}

export function isNativeCallAvailable(): boolean {
  return Platform.OS === "android" && !!Native;
}

export async function showNativeIncomingCall(
  payload: IncomingCallPayload
): Promise<void> {
  if (!Native?.showIncomingCall) return;
  try {
    await Native.showIncomingCall(JSON.stringify(payload));
  } catch {
    // Native presentation is best-effort; JS call UI remains authoritative.
  }
}

export async function stopNativeRinging(): Promise<void> {
  if (!Native?.stopRinging) return;
  try {
    await Native.stopRinging();
  } catch {}
}

export async function setNativeSpeaker(enabled: boolean): Promise<void> {
  if (!Native?.setSpeaker) return;
  try {
    await Native.setSpeaker(enabled);
  } catch {}
}

export async function consumeInitialCallIntent(): Promise<NativeCallIntent | null> {
  if (!Native?.consumeInitialCallIntent) return null;
  try {
    const raw = await Native.consumeInitialCallIntent();
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed?.action) return null;
    return {
      action: parsed.action,
      payload: parsePayload(parsed.payload),
    } as NativeCallIntent;
  } catch {
    return null;
  }
}

export function subscribeNativeCallEvents(
  listeners: {
    onIncoming?: (payload: IncomingCallPayload) => void;
    onAction?: (action: NativeCallAction, payload: IncomingCallPayload | null) => void;
  }
): () => void {
  if (!isNativeCallAvailable()) return () => {};

  const incomingSub = DeviceEventEmitter.addListener(
    NATIVE_CALL_EVENTS.incoming,
    (raw: unknown) => {
      const payload = parsePayload(raw);
      if (payload) listeners.onIncoming?.(payload);
    }
  );

  const actionHandler = (action: NativeCallAction) => (raw: unknown) => {
    const payload = parsePayload(raw);
    listeners.onAction?.(action, payload);
  };
  const answerSub = DeviceEventEmitter.addListener(
    NATIVE_CALL_EVENTS.answer,
    actionHandler("answer")
  );
  const declineSub = DeviceEventEmitter.addListener(
    NATIVE_CALL_EVENTS.decline,
    actionHandler("decline")
  );
  const hangupSub = DeviceEventEmitter.addListener(
    NATIVE_CALL_EVENTS.hangup,
    actionHandler("hangup")
  );

  return () => {
    incomingSub.remove();
    answerSub.remove();
    declineSub.remove();
    hangupSub.remove();
  };
}
