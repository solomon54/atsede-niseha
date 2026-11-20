// Polyfill WeakRef and FinalizationRegistry for Hermes engine
if (typeof (global as any).WeakRef === "undefined") {
  (global as any).WeakRef = class WeakRef {
    private val: any;
    constructor(val: any) {
      this.val = val;
    }
    deref() {
      return this.val;
    }
  };
}
if (typeof (global as any).FinalizationRegistry === "undefined") {
  (global as any).FinalizationRegistry = class FinalizationRegistry {
    register() {}
    unregister() {}
  };
}

import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import * as ScreenCapture from "expo-screen-capture";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerGlobals } from "@livekit/react-native";
import { getActiveChatChannel, setActiveChatChannel } from "../src/lib/active-chat";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { CallProvider, useCallController } from "../src/lib/calling/callController";
import { IncomingCallPayload } from "../src/lib/calling/types";
import { notificationService } from "../src/lib/notifications";
import { mobileSyncService } from "../src/lib/sync";
import { THEME } from "../src/constants/theme";

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

/**
 * Registers the FCM token only after a session exists — at cold start the
 * token is read from SecureStore asynchronously, so registering in RootLayout
 * would always fire an unauthenticated request.
 */
function PushTokenBridge() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    notificationService.registerForPushNotifications();
    const cleanupTokenRefresh = notificationService.setupTokenRefresh();

    return () => {
      cleanupTokenRefresh();
    };
  }, [isAuthenticated, isLoading]);

  return null;
}

/**
 * Notification responses are queued until the session is hydrated. This keeps
 * a cold-start call tap from being replaced by the auth route.
 */
function CallNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { showIncoming, answer, decline } = useCallController();
  const ready = !isLoading && isAuthenticated;
  const readyRef = useRef(ready);
  const pendingRoute = useRef<string | null>(null);
  const pendingPayload = useRef<IncomingCallPayload | null>(null);
  const pendingAction = useRef<{ action: "answer" | "decline"; payload: IncomingCallPayload } | null>(null);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const cleanup = notificationService.setupListeners({
      onNavigate: (route) => {
        if (readyRef.current) router.push(route as any);
        else pendingRoute.current = route;
      },
      onCallPayload: (payload) => {
        if (readyRef.current) showIncoming(payload);
        else pendingPayload.current = payload;
      },
      onCallAction: (action, payload) => {
        if (readyRef.current) {
          showIncoming(payload);
          if (action === "answer") void answer();
          else void decline();
        } else {
          pendingAction.current = { action, payload };
        }
      },
    });
    return cleanup;
  }, [answer, decline, router, showIncoming]);

  useEffect(() => {
    if (!ready) return;
    if (pendingPayload.current) {
      showIncoming(pendingPayload.current);
      pendingPayload.current = null;
    }
    if (pendingAction.current) {
      const { action, payload } = pendingAction.current;
      showIncoming(payload);
      if (action === "answer") void answer();
      else void decline();
      pendingAction.current = null;
    }
    if (pendingRoute.current) {
      router.push(pendingRoute.current as any);
      pendingRoute.current = null;
    }
  }, [answer, decline, ready, router, showIncoming]);

  return null;
}

/**
 * Remove only conversation/message query state when the authenticated account
 * changes. Appointment/profile queries and the offline outbox are untouched.
 */
function MessagingCacheBoundary() {
  const { uid } = useAuth();
  const queryClient = useQueryClient();
  const previousUid = useRef<string | null>(null);

  useEffect(() => {
    if (previousUid.current === uid) return;
    previousUid.current = uid;

    queryClient.removeQueries({ queryKey: ["conversations"] });
    queryClient.removeQueries({ queryKey: ["messages"] });
    setActiveChatChannel(null);
  }, [uid, queryClient]);

  return null;
}

function SyncBridge() {
  const { isAuthenticated, isLoading, uid } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !uid) return;

    mobileSyncService.initRealtimeRecovery(uid);
    mobileSyncService.sync(undefined, uid).catch(() => {});

    // Foreground resume listener: trigger sync when app returns from background
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        mobileSyncService
          .sync(getActiveChatChannel() ?? undefined, uid)
          .catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      // Logout, account switch, or root unmount: remove recovery handlers so
      // the next authenticated session binds once with its own account.
      mobileSyncService.teardownRealtimeRecovery();
    };
  }, [isAuthenticated, isLoading, uid]);

  return null;
}

export default function RootLayout() {
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
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushTokenBridge />
          <CallProvider>
            <CallNotificationBridge />
            <MessagingCacheBoundary />
            <SyncBridge />
            <StatusBar style="dark" backgroundColor={THEME.colors.navigationBg} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: THEME.colors.navigationBg },
                headerTintColor: THEME.colors.sacredCrimson,
                headerTitleStyle: {
                  fontWeight: "800",
                  color: THEME.colors.sacredCrimson,
                },
                contentStyle: { backgroundColor: THEME.colors.sanctuaryBg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="children/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="children/register" options={{ headerShown: false }} />
              <Stack.Screen name="governor/authorize" options={{ headerShown: false }} />
              <Stack.Screen name="governor/fathers" options={{ headerShown: false }} />
              <Stack.Screen name="governor/students" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
            </Stack>
          </CallProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
