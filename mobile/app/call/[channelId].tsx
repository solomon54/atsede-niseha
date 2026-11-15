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
  Image,
  ScrollView,
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
  Phone,
  Volume2,
  VolumeX,
  Users,
  Shield,
  User,
} from "lucide-react-native";
import { apiRequest } from "../../src/lib/api";
import { notificationService } from "../../src/lib/notifications";

interface TokenResponse {
  success: boolean;
  token: string;
  url: string;
  roomName: string;
  maxParticipants: number;
  participantName: string;
}

export default function ChannelCallScreen() {
  const params = useLocalSearchParams<{
    channelId: string;
    incoming?: string;
    callId?: string;
    callerName?: string;
    callerRole?: string;
    callerPhoto?: string;
    isGroup?: string;
  }>();

  const channelId = params.channelId;
  const isIncoming = params.incoming === "1";
  const [callId, setCallId] = useState<string>(params.callId || "");
  const callerName = params.callerName ? decodeURIComponent(params.callerName) : "የንስሐ አባል";
  const callerRole = params.callerRole ? decodeURIComponent(params.callerRole) : "";
  const callerPhoto = params.callerPhoto ? decodeURIComponent(params.callerPhoto) : "";
  const isGroup = params.isGroup === "1";

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [hasAnswered, setHasAnswered] = useState<boolean>(!isIncoming);
  const [answeredAt, setAnsweredAt] = useState<number | null>(!isIncoming ? Date.now() : null);

  const hasRung = useRef(false);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 45s Ringing Timeout Handler
  useEffect(() => {
    // If we're waiting for answer (either incoming or caller waiting)
    timeoutTimerRef.current = setTimeout(async () => {
      if (!hasAnswered) {
        if (channelId && callId) {
          apiRequest("/api/livekit/timeout", {
            method: "POST",
            body: JSON.stringify({ channelId, callId }),
          }).catch(() => {});
        }
        notificationService.dismissCallNotifications();
        handleBack();
      }
    }, 45000);

    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
    };
  }, [hasAnswered, channelId, callId]);

  useEffect(() => {
    let isMounted = true;

    async function initCall() {
      if (!channelId) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch LiveKit Token
        const res = await apiRequest<TokenResponse>("/api/livekit/token", {
          method: "POST",
          body: JSON.stringify({ channelId }),
        });

        if (!isMounted) return;

        if (res.token && res.url) {
          setTokenData(res);
          await AudioSession.startAudioSession();

          // Only the caller rings the other members
          if (!isIncoming && !hasRung.current) {
            hasRung.current = true;
            const ringRes = await apiRequest<{ success: boolean; callId: string }>(
              "/api/livekit/ring",
              {
                method: "POST",
                body: JSON.stringify({ channelId }),
              }
            ).catch((ringErr) => {
              console.warn("Failed to ring channel members:", ringErr);
              return null;
            });

            if (ringRes?.callId) {
              setCallId(ringRes.callId);
            }
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
  }, [channelId, isIncoming]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/chat");
    }
  };

  const handleAnswer = async () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
    }
    setHasAnswered(true);
    setAnsweredAt(Date.now());

    if (channelId) {
      apiRequest("/api/livekit/answer", {
        method: "POST",
        body: JSON.stringify({ channelId, callId }),
      }).catch(() => {});
    }
    notificationService.dismissCallNotifications();
  };

  const handleDecline = async () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
    }
    if (channelId) {
      apiRequest("/api/livekit/decline", {
        method: "POST",
        body: JSON.stringify({ channelId, callId }),
      }).catch(() => {});
    }
    notificationService.dismissCallNotifications();
    try {
      await AudioSession.stopAudioSession();
    } catch {}
    handleBack();
  };

  const handleEndCall = async () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
    }
    const durationSec = answeredAt ? Math.max(1, Math.floor((Date.now() - answeredAt) / 1000)) : 0;
    if (channelId) {
      apiRequest("/api/livekit/end", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          callId,
          durationSec,
          status: hasAnswered ? "answered" : "cancelled",
        }),
      }).catch(() => {});
    }
    notificationService.dismissCallNotifications();
    try {
      await AudioSession.stopAudioSession();
    } catch {}
    handleBack();
  };

  // 1. Incoming Call Ringing Screen (Lock screen & foreground overlay)
  if (isIncoming && !hasAnswered) {
    return (
      <SafeAreaView style={styles.ringingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.ringingHeader}>
          <Text style={styles.ringingBadge}>
            {isGroup ? "✞ የጋራ ቤት የቪዲዮ ጥሪ" : "✞ የቀጥታ የቪዲዮ ጥሪ"}
          </Text>
          <Text style={styles.ringingSub}>የንስሐ ሚስጥር ጥሪ እየቀረበ ነው</Text>
        </View>

        <View style={styles.ringingCenter}>
          <View style={styles.ringingAvatarBorder}>
            {callerPhoto ? (
              <Image source={{ uri: callerPhoto }} style={styles.ringingAvatarImg} />
            ) : (
              <View style={styles.ringingAvatarPlaceholder}>
                <Text style={styles.ringingAvatarInitial}>
                  {callerName.charAt(0) || "✞"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.ringingCallerName}>{callerName}</Text>
          <Text style={styles.ringingCallerRole}>
            {callerRole === "FATHER" ? "የንስሐ አባት" : "የንስሐ ልጅ"}
          </Text>
          <Text style={styles.ringingStatusText}>ጥሪ በመደወል ላይ...</Text>
        </View>

        <View style={styles.ringingActions}>
          <TouchableOpacity
            style={[styles.ringActionBtn, styles.declineBtn]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <PhoneOff color="#FFFFFF" size={32} />
            <Text style={styles.actionBtnText}>አትቀበል</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ringActionBtn, styles.answerBtn]}
            onPress={handleAnswer}
            activeOpacity={0.8}
          >
            <Phone color="#FFFFFF" size={32} />
            <Text style={styles.actionBtnText}>ተቀበል</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            isGroup={isGroup}
            onEndCall={handleEndCall}
          />
        </View>
      </LiveKitRoom>
    </SafeAreaView>
  );
}

// ─── ACTIVE CALL INTERFACE WITH ADAPTIVE RENDERING ───────────────────────
function ActiveCallView({
  channelId,
  maxParticipants,
  isGroup,
  onEndCall,
}: {
  channelId: string;
  maxParticipants: number;
  isGroup: boolean;
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

  // Adaptive 3-Tier Group Layout:
  // Tier 1: Active Speaker Stage (1 dominant participant)
  // Tier 2: Horizontal Tray (max 6 thumbnails)
  // Tier 3: Participant List for anyone else
  const activeSpeakerTrack = remoteTracks[0] || null;
  const trayTracks = remoteTracks.slice(1, 7);
  const overflowParticipants = remoteTracks.slice(7);

  return (
    <View style={styles.activeContainer}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.callBadge}>
            {isGroup ? "✞ የጋራ ቤት ምክክር" : "✞ የቪዲዮ ምክክር"}
          </Text>
          <View style={styles.participantBadge}>
            <Users color="#D97706" size={12} />
            <Text style={styles.participantText}>
              {remoteTracks.length + 1} ተሳታፊዎች
            </Text>
          </View>
        </View>
        <Text style={styles.securityHint}>ይህ ጥሪ በሚስጥር የተጠበቀ ነው (ታሕተ ማኅተም)</Text>
      </View>

      {/* Main Video Area: 1 Dominant Stage */}
      <View style={styles.videoStageContainer}>
        {remoteTracks.length === 0 ? (
          <View style={styles.waitingContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarCross}>✞</Text>
            </View>
            <Text style={styles.waitingTitle}>እየጠራ ነው... ተሳታፊዎችን በመጠበቅ ላይ</Text>
            <Text style={styles.waitingSubtitle}>
              ተሳታፊዎች እስኪገቡ ድረስ ይጠብቁ
            </Text>
          </View>
        ) : (
          <View style={styles.stageVideoTile}>
            {activeSpeakerTrack?.publication?.track &&
            !activeSpeakerTrack.publication?.isMuted ? (
              <VideoTrack
                trackRef={activeSpeakerTrack}
                style={styles.remoteVideo}
                objectFit="cover"
              />
            ) : (
              <View style={styles.avatarTileFallback}>
                <View style={styles.avatarInitialCircle}>
                  <Text style={styles.avatarInitialText}>
                    {activeSpeakerTrack?.participant.name?.charAt(0) || "✞"}
                  </Text>
                </View>
                <Text style={styles.avatarNameText}>
                  {activeSpeakerTrack?.participant.name || "ተሳታፊ"}
                </Text>
                <Text style={styles.avatarCameraOffSub}>ካሜራ ጠፍቷል</Text>
              </View>
            )}
            <View style={styles.tileNameBadge}>
              <Text style={styles.tileNameText} numberOfLines={1}>
                {activeSpeakerTrack?.participant.name || "ተሳታፊ"}
              </Text>
            </View>
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

      {/* Tier 2: Horizontal Video Tray (Max 6 thumbnails for group calls) */}
      {trayTracks.length > 0 && (
        <View style={styles.trayWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trayScrollContent}
          >
            {trayTracks.map((tRef, idx) => {
              const isVideo = tRef.publication?.track && !tRef.publication?.isMuted;
              return (
                <View key={tRef.participant.identity || idx} style={styles.trayTile}>
                  {isVideo ? (
                    <VideoTrack
                      trackRef={tRef}
                      style={styles.trayVideo}
                      objectFit="cover"
                    />
                  ) : (
                    <View style={styles.trayFallback}>
                      <Text style={styles.trayInitial}>
                        {tRef.participant.name?.charAt(0) || "✞"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.trayNameBadge}>
                    <Text style={styles.trayNameText} numberOfLines={1}>
                      {tRef.participant.name || "ተሳታፊ"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Tier 3: Scrollable Participant List for Large Calls */}
      {overflowParticipants.length > 0 && (
        <View style={styles.overflowListWrapper}>
          <Text style={styles.overflowTitle}>ተጨማሪ ተሳታፊዎች ({overflowParticipants.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {overflowParticipants.map((p, idx) => (
              <View key={p.participant.identity || idx} style={styles.overflowPill}>
                <User size={12} color="#D97706" />
                <Text style={styles.overflowPillText}>
                  {p.participant.name || "ተሳታፊ"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom Controls Bar */}
      <View style={styles.controlsBar}>
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
    paddingBottom: 8,
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
  videoStageContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  stageVideoTile: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
  },
  trayWrapper: {
    height: 96,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  trayScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  trayTile: {
    width: 90,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    position: "relative",
  },
  trayVideo: {
    width: "100%",
    height: "100%",
  },
  trayFallback: {
    flex: 1,
    backgroundColor: "#0B1120",
    alignItems: "center",
    justifyContent: "center",
  },
  trayInitial: {
    color: "#D97706",
    fontSize: 20,
    fontWeight: "800",
  },
  trayNameBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trayNameText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  overflowListWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  overflowTitle: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  overflowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  overflowPillText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
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
    fontSize: 11,
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
    fontSize: 16,
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
    bottom: 12,
    right: 12,
    width: 96,
    height: 130,
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

  // ─── Incoming Call Ringing Styles (Full screen / lock screen)
  ringingContainer: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  ringingHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  ringingBadge: {
    color: "#D97706",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  ringingSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 6,
  },
  ringingCenter: {
    alignItems: "center",
  },
  ringingAvatarBorder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#D97706",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    marginBottom: 20,
  },
  ringingAvatarImg: {
    width: "100%",
    height: "100%",
  },
  ringingAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#78350F",
    alignItems: "center",
    justifyContent: "center",
  },
  ringingAvatarInitial: {
    color: "#FEF3C7",
    fontSize: 54,
    fontWeight: "900",
  },
  ringingCallerName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  ringingCallerRole: {
    color: "#F59E0B",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
  },
  ringingStatusText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  ringingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  ringActionBtn: {
    alignItems: "center",
    gap: 8,
  },
  declineBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  answerBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
});
