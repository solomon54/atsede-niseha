import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./api";

export const PUSH_CHANNELS = {
  urgent: "atsede-urgent",
  messages: "atsede-messages",
  appointments: "atsede-appointments",
} as const;

// Configure how notifications appear when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.urgent, {
    name: "ጥሪዎችና አስቸኳይ ማሳወቂያዎች",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#D97706",
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

  if (data.type === "incoming_call" && channelId) {
    onNavigate(`/call/${channelId}?incoming=1`);
    return;
  }

  if (channelId) {
    onNavigate(`/chat/${channelId}`);
    return;
  }

  if (typeof data.appointmentId === "string") {
    onNavigate("/(tabs)/appointments");
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

    const subReceived = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Foreground notification received:", notification);
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
};
