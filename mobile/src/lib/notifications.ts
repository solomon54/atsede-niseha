import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./api";
import { authStorage } from "./storage";
import {
  IncomingCallPayload,
  toIncomingPayload,
} from "./calling/types";

export const PUSH_CHANNELS = {
  call: "atsede-call",
  urgent: "atsede-call",
  messages: "atsede-messages",
  appointments: "atsede-appointments",
} as const;

export type CallNotificationAction = "answer" | "decline";

export interface NotificationListenerHandlers {
  onNavigate: (route: string) => void;
  onCallPayload?: (payload: IncomingCallPayload) => void;
  onCallAction?: (
    action: CallNotificationAction,
    payload: IncomingCallPayload
  ) => void;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isCall = notification.request.content.data?.type === "incoming_call";
    return {
      shouldShowAlert: true,
      shouldPlaySound: isCall ? false : true,
      shouldSetBadge: !isCall,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  // Immutable channel settings: keep this channel id/importance stable.
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.call, {
    name: "ጥሪዎች (Incoming Calls)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: "#D97706",
    sound: "call_ring",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    enableVibrate: true,
    showBadge: false,
  });

  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.messages, {
    name: "አዲስ መልእክቶች",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180],
    lightColor: "#D97706",
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.appointments, {
    name: "የቀጠሮ ማሳወቂያዎች",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#D97706",
    sound: "default",
  });

  try {
    await Notifications.setNotificationCategoryAsync("incoming_call", [
      {
        identifier: "ANSWER_CALL",
        buttonTitle: "ተቀበል 🟢",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "DECLINE_CALL",
        buttonTitle: "አትቀበል 🔴",
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (err) {
    console.warn("Could not register notification category:", err);
  }
}

async function saveDeviceToken(token: string): Promise<void> {
  await authStorage.saveFcmToken(token);
  await apiRequest("/api/notifications/fcm", {
    method: "POST",
    body: JSON.stringify({ fcmToken: token, platform: Platform.OS }),
  });
}

function callRoute(payload: IncomingCallPayload): string {
  return `/call/${payload.channelId}?${[
    `callId=${encodeURIComponent(payload.callId)}`,
    `incoming=1`,
    `name=${encodeURIComponent(payload.callerName)}`,
    `role=${encodeURIComponent(payload.callerRole || "STUDENT")}`,
    `photo=${encodeURIComponent(payload.callerPhotoUrl || "")}`,
    `isGroup=${payload.isGroup ? "1" : "0"}`,
  ].join("&")}`;
}

function routeFromNotification(
  response: Notifications.NotificationResponse,
  handlers: NotificationListenerHandlers
): void {
  const data = (response.notification.request.content.data ?? {}) as Record<
    string,
    unknown
  >;
  const payload = toIncomingPayload(data);

  if (data.type === "incoming_call" && payload) {
    if (response.actionIdentifier === "DECLINE_CALL") {
      handlers.onCallAction?.("decline", payload);
      return;
    }
    if (response.actionIdentifier === "ANSWER_CALL") {
      handlers.onCallAction?.("answer", payload);
      return;
    }
    handlers.onCallPayload?.(payload);
    handlers.onNavigate(callRoute(payload));
    return;
  }

  const channelId = typeof data.channelId === "string" ? data.channelId : null;
  const messageId = typeof data.messageId === "string" ? data.messageId : "";
  if (channelId) {
    const suffix = messageId ? `?targetMessageId=${encodeURIComponent(messageId)}` : "";
    handlers.onNavigate(`/chat/${channelId}${suffix}`);
    return;
  }

  if (typeof data.appointmentId === "string") {
    handlers.onNavigate(
      `/(tabs)/appointments?appointment=${encodeURIComponent(data.appointmentId)}`
    );
  }
}

const callNotificationIds = new Set<string>();

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    try {
      await ensureAndroidChannels();

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Push notification permission not granted");
        return null;
      }

      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = typeof tokenData.data === "string" ? tokenData.data : "";
      if (!token) return null;

      await saveDeviceToken(token);
      return token;
    } catch (e) {
      console.warn("Push registration skipped (FCM not configured for this build):", e);
      return null;
    }
  },

  /** Re-register when FCM rotates the device token. Call only while signed in. */
  setupTokenRefresh(): () => void {
    const subscription = Notifications.addPushTokenListener((token) => {
      const value = typeof token === "string" ? token : token.data;
      if (value) saveDeviceToken(value).catch(() => {});
    });
    return () => subscription.remove();
  },

  setupListeners(handlers: NotificationListenerHandlers) {
    const handled = new Set<string>();
    const handle = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      routeFromNotification(response, handlers);
    };

    const subReceived = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;
        if (data?.type !== "incoming_call") return;
        callNotificationIds.add(notification.request.identifier);
        const payload = toIncomingPayload(data as Record<string, unknown>);
        if (payload) handlers.onCallPayload?.(payload);
      }
    );

    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => handle(response)
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch((err) =>
        console.warn("Failed to read last notification response:", err)
      );

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  },

  /** Stop pushes for this device only (called on logout). */
  async unregisterForPushNotifications(): Promise<void> {
    const token = await authStorage.getFcmToken().catch(() => null);
    if (token) {
      await apiRequest("/api/notifications/fcm", {
        method: "DELETE",
        body: JSON.stringify({ fcmToken: token }),
      }).catch(() => {});
    }
    await authStorage.clearFcmToken().catch(() => {});
  },

  /** Clear only call notifications tracked by this app session. */
  async dismissCallNotifications(): Promise<void> {
    const ids = [...callNotificationIds];
    callNotificationIds.clear();
    await Promise.all(
      ids.map((id) => Notifications.dismissNotificationAsync(id).catch(() => {}))
    );
  },
};
