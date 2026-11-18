import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./api";

export const PUSH_CHANNELS = {
  call: "atsede-call",
  urgent: "atsede-call",
  messages: "atsede-messages",
  appointments: "atsede-appointments",
} as const;

// Configure how notifications appear when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isCall = notification.request.content.data?.type === "incoming_call";
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  // 1. Incoming Call Channel: MAX importance, custom sound, vibration, public visibility
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.call, {
    name: "ጥሪዎች (Incoming Calls)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: "#D97706",
    sound: "call_ring",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    enableVibrate: true,
    showBadge: true,
  });

  // 2. Chat Messages: High importance, default sound
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.messages, {
    name: "አዲስ መልእክቶች",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180],
    lightColor: "#D97706",
    sound: "default",
  });

  // 3. Appointments: Default importance
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.appointments, {
    name: "የቀጠሮ ማሳወቂያዎች",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#D97706",
    sound: "default",
  });

  // 4. Setup Interactive Actions for Incoming Call (usable from lock screen)
  try {
    await Notifications.setNotificationCategoryAsync("incoming_call", [
      {
        identifier: "ANSWER_CALL",
        buttonTitle: "ተቀበል 🟢",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "DECLINE_CALL",
        buttonTitle: "አትቀበል 🔴",
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  } catch (err) {
    console.warn("Could not register notification category:", err);
  }
}

async function saveDeviceToken(token: string): Promise<void> {
  await apiRequest("/api/notifications/fcm", {
    method: "POST",
    body: JSON.stringify({
      fcmToken: token,
      platform: Platform.OS,
    }),
  });
}

function routeFromNotification(
  response: Notifications.NotificationResponse,
  onNavigate: (route: string) => void
): void {
  const data = (response.notification.request.content.data ?? {}) as Record<
    string,
    unknown
  >;

  const channelId = typeof data.channelId === "string" ? data.channelId : null;
  const callId = typeof data.callId === "string" ? data.callId : "";
  const messageId = typeof data.messageId === "string" ? data.messageId : "";

  if (data.type === "incoming_call" && channelId) {
    // If the user tapped Decline directly on the notification action
    if (response.actionIdentifier === "DECLINE_CALL") {
      if (callId) {
        apiRequest("/api/livekit/decline", {
          method: "POST",
          body: JSON.stringify({ channelId, callId }),
        }).catch(() => {});
      }
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
      // Best-effort: clear other call notifications for this tag/call
      Notifications.dismissAllNotificationsAsync().catch(() => {});
      return;
    }

    const callerName = typeof data.callerName === "string" ? data.callerName : "";
    const callerRole = typeof data.callerRole === "string" ? data.callerRole : "";
    const callerPhoto = typeof data.callerPhotoUrl === "string" ? data.callerPhotoUrl : "";
    const isGroup = data.isGroup === "true" || data.isGroup === true ? "1" : "0";

    onNavigate(
      `/call/${channelId}?incoming=1&callId=${encodeURIComponent(callId)}&callerName=${encodeURIComponent(
        callerName
      )}&callerRole=${encodeURIComponent(
        callerRole
      )}&callerPhoto=${encodeURIComponent(callerPhoto)}&isGroup=${isGroup}`
    );
    return;
  }

  if (channelId) {
    const suffix = messageId ? `?targetMessageId=${encodeURIComponent(messageId)}` : "";
    onNavigate(`/chat/${channelId}${suffix}`);
    return;
  }

  if (typeof data.appointmentId === "string") {
    onNavigate(
      `/(tabs)/appointments?appointment=${encodeURIComponent(data.appointmentId)}`
    );
  }
}

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    try {
      await ensureAndroidChannels();

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Push notification permission not granted");
        return null;
      }

      // Native FCM token. Expo push tokens are deliberately not used: the
      // server sends through firebase-admin.
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;

      if (!token) {
        console.warn("No device push token available");
        return null;
      }

      await saveDeviceToken(token);
      return token;
    } catch (e) {
      // Most commonly: google-services.json missing from the Android build.
      console.warn(
        "Push registration skipped (FCM not configured for this build):",
        e
      );
      return null;
    }
  },

  /**
   * Re-register when FCM rotates the device token. Call only while signed in.
   */
  setupTokenRefresh(): () => void {
    const subscription = Notifications.addPushTokenListener((token) => {
      saveDeviceToken(token.data).catch((err) => {
        console.warn("Failed to refresh FCM token:", err);
      });
    });

    return () => subscription.remove();
  },

  setupListeners(onNavigate: (route: string) => void) {
    const handled = new Set<string>();

    const handle = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      routeFromNotification(response, onNavigate);
    };

    let lastIncomingNavKey = "";
    let lastIncomingNavAt = 0;
    const subReceived = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;
        if (data?.type === "incoming_call" && data.channelId) {
          const channelId = String(data.channelId);
          const callId = String(data.callId || "");
          const navKey = `${channelId}:${callId}`;
          const now = Date.now();
          // Dedupe foreground re-delivery/navigation for the same incoming call.
          if (navKey === lastIncomingNavKey && now - lastIncomingNavAt < 15000) {
            return;
          }
          lastIncomingNavKey = navKey;
          lastIncomingNavAt = now;

          const callerName = String(data.callerName || "");
          const callerRole = String(data.callerRole || "");
          const callerPhoto = String(data.callerPhotoUrl || "");
          const isGroup = data.isGroup === "true" || data.isGroup === true ? "1" : "0";

          onNavigate(
            `/call/${channelId}?incoming=1&callId=${encodeURIComponent(callId)}&callerName=${encodeURIComponent(
              callerName
            )}&callerRole=${encodeURIComponent(
              callerRole
            )}&callerPhoto=${encodeURIComponent(callerPhoto)}&isGroup=${isGroup}`
          );
        }
      }
    );

    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => handle(response)
    );

    // Cold start: the app was launched by tapping a notification.
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

  /** Stop pushes for this device (called on logout). */
  async unregisterForPushNotifications(): Promise<void> {
    await apiRequest("/api/notifications/fcm", {
      method: "DELETE",
    }).catch((err) => {
      console.warn("Failed to clear FCM token on logout:", err);
    });
  },

  /** Clear call notifications across devices when answered/declined. */
  async dismissCallNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch {}
  },
};
