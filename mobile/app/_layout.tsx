import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ScreenCapture from "expo-screen-capture";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerGlobals } from "@livekit/react-native";
import { AuthProvider } from "../src/lib/auth-context";
import { notificationService } from "../src/lib/notifications";

// Register LiveKit WebRTC and Audio Globals
try {
  registerGlobals();
} catch (e) {
  console.warn("LiveKit registerGlobals notice:", e);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 3, // 3 minutes
    },
  },
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // 1. Enable FLAG_SECURE on Android to protect pastoral counseling screens
    async function enableScreenPrivacy() {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (err) {
        console.warn("Screen capture prevention not available:", err);
      }
    }
    enableScreenPrivacy();

    // 2. Register for Push Notifications & Setup Deep-link navigation
    notificationService.registerForPushNotifications();
    const cleanupListeners = notificationService.setupListeners((targetRoute) => {
      router.push(targetRoute as any);
    });

    return () => {
      cleanupListeners();
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#0F172A" },
              headerTintColor: "#F8FAFC",
              headerTitleStyle: { fontWeight: "600" },
              contentStyle: { backgroundColor: "#0B1120" },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

