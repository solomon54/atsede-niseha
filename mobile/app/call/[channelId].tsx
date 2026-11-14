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

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  LiveKitRoom,
  VideoTrack,
  AudioSession,
  useTracks,
  useLocalParticipant,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Users,
  Shield,
} from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface TokenResponse {
  success: boolean;
  token: string;
  url: string;
  roomName: string;
  maxParticipants: number;
  participantName: string;
}

export default function ChannelCallScreen() {
  const { channelId, incoming } = useLocalSearchParams<{
    channelId: string;
    incoming?: string;
  }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const hasRung = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function initCall() {
      if (!channelId) return;
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Room Token from Server
        const res = await apiRequest<TokenResponse>("/api/livekit/token", {
          method: "POST",
          body: JSON.stringify({ channelId }),
        });

        if (!isMounted) return;

        if (res.token && res.url) {
          setTokenData(res);
          // 2. Start LiveKit Audio Session on device
          await AudioSession.startAudioSession();

          // 3. Ring the other participants (the callee opened this screen
          //    from a push, so only the caller rings).
          if (incoming !== "1" && !hasRung.current) {
            hasRung.current = true;
            apiRequest("/api/livekit/ring", {
              method: "POST",
              body: JSON.stringify({ channelId }),
            }).catch((ringErr) => {
              console.warn("Failed to ring channel members:", ringErr);
            });
          }
        } else {
          setError("የቪዲዮ ጥሪ ፈቃድ ማግኘት አልተቻለም");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "የኔትወርክ ወይም የክፍል ስህተት");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initCall();

    return () => {
      isMounted = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [channelId, incoming]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/chat");
    }
  };

  const handleEndCall = async () => {
    if (channelId) {
      apiRequest("/api/livekit/decline", {
        method: "POST",
        body: JSON.stringify({ channelId }),
      }).catch(() => {});
    }
    try {
      await AudioSession.stopAudioSession();
    } catch {}
    handleBack();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>የተጠበቀ የመንፈሳዊ ጥሪ ክፍል እየተዘጋጀ ነው...</Text>
      </View>
    );
  }

  if (error || !tokenData) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <Shield color="#EF4444" size={48} />
        <Text style={styles.errorTitle}>ጥሪውን መጀመር አልተቻለም</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>ወደ ውይይት ተመለስ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LiveKitRoom
        serverUrl={tokenData.url}
        token={tokenData.token}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={handleEndCall}
      >
        <View style={styles.roomContainer}>
          <ActiveCallView
            channelId={channelId!}
            maxParticipants={tokenData.maxParticipants}
            onEndCall={handleEndCall}
          />
        </View>
      </LiveKitRoom>
    </SafeAreaView>
  );
}

// ─── ACTIVE CALL INTERFACE ──────────────────────────────────────────
function ActiveCallView({
  channelId,
  maxParticipants,
  onEndCall,
}: {
  channelId: string;
  maxParticipants: number;
  onEndCall: () => void;
}) {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();

  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Tracks query: Get all Camera tracks
  const tracks = useTracks([Track.Source.Camera]);

  const remoteTracks = tracks.filter(
    (t) => t.participant.identity !== localParticipant.identity
  );
  const localTrack = tracks.find(
    (t) => t.participant.identity === localParticipant.identity
  );

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (e) {
      console.warn("Toggle mic error:", e);
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (e) {
      console.warn("Toggle camera error:", e);
    }
  };

  const toggleSpeaker = async () => {
    setIsSpeakerOn((prev) => !prev);
  };

  return (
    <View style={styles.activeContainer}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.callBadge}>✞ የቪዲዮ ምክክር</Text>
          <View style={styles.participantBadge}>
            <Users color="#D97706" size={12} />
            <Text style={styles.participantText}>
              {remoteTracks.length + 1}/{maxParticipants}
            </Text>
          </View>
        </View>
        <Text style={styles.securityHint}>ይህ ጥሪ በሚስጥር የተጠበቀ ነው (ታሕተ ማኅተም)</Text>
      </View>

      {/* Main Remote Video Area */}
      <View style={styles.videoGrid}>
        {remoteTracks.length === 0 ? (
          <View style={styles.waitingContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarCross}>✞</Text>
            </View>
            <Text style={styles.waitingTitle}>ተሳታፊዎችን በመጠበቅ ላይ...</Text>
            <Text style={styles.waitingSubtitle}>
              {maxParticipants === 2
                ? "የንስሐ አባትዎ ወይም ልጅዎ እስኪገቡ ድረስ ይጠብቁ"
                : "የጋራ ቤት ተሳታፊዎች እስኪገቡ ድረስ ይጠብቁ"}
            </Text>
          </View>
        ) : (
          <View style={remoteTracks.length === 1 ? styles.singleRemoteContainer : styles.multiRemoteContainer}>
            {remoteTracks.map((trackRef, idx) => {
              const isVideoActive =
                trackRef.publication?.track && !trackRef.publication?.isMuted;
              const pName = trackRef.participant.name || trackRef.participant.identity || "ተሳታፊ";
              const pInitial = pName.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "").charAt(0) || "✞";

              return (
                <View
                  key={trackRef.participant.identity || idx}
                  style={remoteTracks.length === 1 ? styles.singleRemoteTile : styles.multiRemoteTile}
                >
                  {isVideoActive ? (
                    <VideoTrack
                      trackRef={trackRef}
                      style={styles.remoteVideo}
                      objectFit="cover"
                    />
                  ) : (
                    <View style={styles.avatarTileFallback}>
                      <View style={styles.avatarInitialCircle}>
                        <Text style={styles.avatarInitialText}>{pInitial}</Text>
                      </View>
                      <Text style={styles.avatarNameText}>{pName}</Text>
                      <Text style={styles.avatarCameraOffSub}>ካሜራ ጠፍቷል</Text>
                    </View>
                  )}

                  <View style={styles.tileNameBadge}>
                    <Text style={styles.tileNameText} numberOfLines={1}>
                      {pName}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Floating Local Camera Preview */}
        {localTrack?.publication?.track && (
          <View style={styles.localPreviewBox}>
            {isCameraEnabled && !localTrack.publication.isMuted ? (
              <VideoTrack
                trackRef={localTrack}
                style={styles.localVideo}
                objectFit="cover"
              />
            ) : (
              <View style={styles.localCameraOffBox}>
                <Text style={styles.localInitialText}>እርስዎ</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom Controls Bar */}
      <View style={styles.controlsBar}>
        {/* Mic Toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, !isMicrophoneEnabled && styles.controlBtnOff]}
          onPress={toggleMic}
        >
          {isMicrophoneEnabled ? (
            <Mic color="#FFFFFF" size={22} />
          ) : (
            <MicOff color="#EF4444" size={22} />
          )}
        </TouchableOpacity>

        {/* Camera Toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnOff]}
          onPress={toggleCamera}
        >
          {isCameraEnabled ? (
            <VideoIcon color="#FFFFFF" size={22} />
          ) : (
            <VideoOff color="#EF4444" size={22} />
          )}
        </TouchableOpacity>

        {/* Speaker Toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnOff]}
          onPress={toggleSpeaker}
        >
          {isSpeakerOn ? (
            <Volume2 color="#FFFFFF" size={22} />
          ) : (
            <VolumeX color="#EF4444" size={22} />
          )}
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={onEndCall}
        >
          <PhoneOff color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
  },
  roomContainer: {
    flex: 1,
  },
  activeContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#0B1120",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#CBD5E1",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
  errorTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  errorSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  callBadge: {
    color: "#D97706",
    fontSize: 16,
    fontWeight: "700",
  },
  participantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  participantText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  securityHint: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
  },
  videoGrid: {
    flex: 1,
    backgroundColor: "#0F172A",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
  },
  singleRemoteContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  singleRemoteTile: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  multiRemoteContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 4,
  },
  multiRemoteTile: {
    width: "48.5%",
    height: "48.5%",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1E293B",
  },
  avatarTileFallback: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0B1120",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  avatarInitialCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#78350F",
    borderWidth: 2,
    borderColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarInitialText: {
    color: "#FEF3C7",
    fontSize: 26,
    fontWeight: "900",
  },
  avatarNameText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  avatarCameraOffSub: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  tileNameBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: "80%",
  },
  tileNameText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  localCameraOffBox: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  localInitialText: {
    color: "#D97706",
    fontSize: 12,
    fontWeight: "800",
  },
  waitingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#78350F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#D97706",
  },
  avatarCross: {
    color: "#D97706",
    fontSize: 44,
  },
  waitingTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  waitingSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  localPreviewBox: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#D97706",
    backgroundColor: "#1E293B",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: "#0F172A",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  controlBtnOff: {
    backgroundColor: "#450A0A",
    borderColor: "#7F1D1D",
  },
  endCallBtn: {
    backgroundColor: "#DC2626",
    borderColor: "#B91C1C",
  },
});
