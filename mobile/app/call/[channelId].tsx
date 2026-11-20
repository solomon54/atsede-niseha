import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BackHandler } from "react-native";
import { Phone, PhoneOff, Shield } from "lucide-react-native";

import { useCallController } from "../../src/lib/calling/callController";
import {
  callRoleLabel,
  toIncomingPayload,
} from "../../src/lib/calling/types";

function value(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function ChannelCallScreen() {
  const params = useLocalSearchParams<{
    channelId: string;
    callId?: string;
    incoming?: string;
    name?: string;
    role?: string;
    photo?: string;
    isGroup?: string;
    resume?: string;
  }>();
  const router = useRouter();
  const {
    call,
    showIncoming,
    startOutgoing,
    answer,
    decline,
    end,
  } = useCallController();
  const startedRef = useRef(false);

  const channelId = value(params.channelId);
  const routeCallId = value(params.callId);
  const isIncoming = params.incoming === "1" || params.incoming === "true";
  const startedOnce = () => {
    if (startedRef.current) return false;
    startedRef.current = true;
    return true;
  };

  useEffect(() => {
    if (!channelId || !startedOnce()) return;
    const current = call;
    if (current && current.channelId === channelId && current.status !== "ended") {
      return;
    }

    if (isIncoming && routeCallId) {
      const payload = toIncomingPayload({
        type: "incoming_call",
        categoryId: "incoming_call",
        callId: routeCallId,
        channelId,
        callerId: "",
        callerName: value(params.name),
        callerPhotoUrl: value(params.photo),
        callerRole: value(params.role),
        isGroup: params.isGroup === "1" ? "true" : "false",
      });
      if (payload) showIncoming(payload);
      return;
    }

    void startOutgoing(channelId);
    // The screen must not restart an existing call when it remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => {
        const current = call;
        if (!current) return false;
        if (current.status === "incoming") void decline();
        else if (current.status === "ringing") void end();
        else {
          // Active room is global; leaving the screen does not end the call.
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/chat");
        }
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [call, decline, end, router])
  );

  const active = call?.channelId === channelId ? call : null;

  if (active?.terminal) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" />
        <PhoneOff color="#D97706" size={44} />
        <Text style={styles.title}>ጥሪው ተጠናቋል</Text>
        <Text style={styles.subtitle}>{active.terminal.message}</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/chat");
          }}
        >
          <Text style={styles.secondaryText}>ወደ ውይይት ተመለስ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (active?.status === "answered") {
    // The active room is a single app-level overlay; this route intentionally
    // renders no second LiveKit connection.
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#D97706" />
        <Text style={styles.subtitle}>ንቁ ጥሪው እየታየ ነው…</Text>
      </View>
    );
  }

  if (!active || active.status === "incoming") {
    const peer = active?.peer || {
      name: value(params.name) || "የንስሐ አባል",
      role: value(params.role) || "STUDENT",
      photoUrl: value(params.photo) || null,
    };
    return (
      <SafeAreaView style={styles.ringing}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.badge}>
            {active?.isGroup ? "✞ የጋራ ቤት የቪዲዮ ጥሪ" : "✞ የቀጥታ የቪዲዮ ጥሪ"}
          </Text>
          <Text style={styles.subtitle}>የንስሐ ሚስጥር ጥሪ እየቀረበ ነው</Text>
        </View>
        <View style={styles.peerArea}>
          {peer.photoUrl ? (
            <Image source={{ uri: peer.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initial}>{peer.name.charAt(0) || "✞"}</Text>
            </View>
          )}
          <Text style={styles.peerName}>{peer.name}</Text>
          <Text style={styles.peerRole}>{callRoleLabel(peer.role)}</Text>
          <Text style={styles.ringingStatus}>ጥሪ በመደወል ላይ...</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.action, styles.decline]}
            onPress={() => void decline()}
          >
            <PhoneOff color="#FFFFFF" size={30} />
            <Text style={styles.actionText}>አትቀበል</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.answer]}
            onPress={() => void answer()}
            disabled={active?.transitioning}
          >
            <Phone color="#FFFFFF" size={30} />
            <Text style={styles.actionText}>ተቀበል</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.center}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color="#D97706" />
      <Text style={styles.subtitle}>የተጠበቀ የመንፈሳዊ ጥሪ ክፍል እየተዘጋጀ ነው...</Text>
      <Shield color="#475569" size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  ringing: { flex: 1, backgroundColor: "#0B1120", justifyContent: "space-between", paddingVertical: 28 },
  center: { flex: 1, backgroundColor: "#0B1120", alignItems: "center", justifyContent: "center", padding: 24 },
  header: { alignItems: "center" },
  badge: { color: "#D97706", fontSize: 14, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 12, marginTop: 8, textAlign: "center" },
  peerArea: { alignItems: "center" },
  avatar: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: "#D97706" },
  avatarFallback: { backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  initial: { color: "#F8FAFC", fontSize: 48, fontWeight: "800" },
  peerName: { color: "#F8FAFC", fontSize: 24, fontWeight: "800", marginTop: 18 },
  peerRole: { color: "#D97706", fontSize: 14, marginTop: 4 },
  ringingStatus: { color: "#CBD5E1", fontSize: 13, marginTop: 16 },
  actions: { flexDirection: "row", justifyContent: "space-evenly", paddingHorizontal: 20 },
  action: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  decline: { backgroundColor: "#DC2626" },
  answer: { backgroundColor: "#16A34A" },
  actionText: { color: "#FFFFFF", fontWeight: "800", marginTop: 8 },
  title: { color: "#F8FAFC", fontSize: 18, fontWeight: "800", marginTop: 14 },
  secondaryButton: { marginTop: 24, backgroundColor: "#1E293B", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  secondaryText: { color: "#F8FAFC", fontWeight: "700" },
});
