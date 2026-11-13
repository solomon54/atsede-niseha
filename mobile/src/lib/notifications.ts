import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./api";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("atsede-urgent", {
          name: "ዐጸደ ንስሐ ማሳወቂያዎች",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#D97706",
          sound: "default",
        });
      }

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

      const tokenData = await Notifications.getDevicePushTokenAsync().catch(
        async () => await Notifications.getExpoPushTokenAsync()
      );

      const token = tokenData.data;

      // Register with Next.js server
      await apiRequest("/api/notifications/fcm", {
        method: "POST",
        body: JSON.stringify({
          fcmToken: token,
          platform: Platform.OS,
        }),
      }).catch((err) => {
        console.warn("Failed registering FCM token with backend:", err);
      });

      return token;
    } catch (e) {
      console.warn("Push notification registration skipped (dev/simulator):", e);
      return null;
    }
  },

  setupListeners(onNavigate: (route: string) => void) {
    // When notification is received while foregrounded
    const subReceived = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Foreground notification received:", notification);
      }
    );

    // When user taps on notification
    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.channelId) {
          onNavigate(`/chat/${data.channelId}`);
        } else if (data?.appointmentId) {
          onNavigate("/(tabs)/appointments");
        }
      }
    );

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  },
};

