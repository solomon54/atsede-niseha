import React, { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import {
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  User,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react-native";

import { setNativeSpeaker } from "../../lib/calling/nativeCall";
import { ActiveCallState, CallPeer, callRoleLabel } from "../../lib/calling/types";

interface ActiveCallViewProps {
  call: ActiveCallState;
  onEndCall: () => void;
  onMinimize?: () => void;
}

function durationLabel(startedAt?: number | null): string {
  if (!startedAt) return "00:00";
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mins = Math.floor(total / 60).toString().padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function PeerPhoto({
  peer,
  name,
  size,
}: {
  peer?: CallPeer | null;
  name?: string | null;
  size: number;
}) {
  const photoUrl = peer?.photoUrl;
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
        resizeMode="cover"
      />
    );
  }
  const cleanName = (name || peer?.name || "").trim();
  const initial = cleanName ? cleanName.charAt(0) : "✞";
  return (
    <View style={[styles.initialCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initialText, { fontSize: size * 0.36 }]}>
        {initial}
      </Text>
    </View>
  );
}

export default function ActiveCallView({
  call,
  onEndCall,
  onMinimize,
}: ActiveCallViewProps) {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const cameraRefs = useTracks([Track.Source.Camera]);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(() => durationLabel(call.answeredAt));

  useEffect(() => {
    if (!onMinimize) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onMinimize();
      return true;
    });
    return () => sub.remove();
  }, [onMinimize]);

  useEffect(() => {
    const tick = () => setElapsed(durationLabel(call.answeredAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.answeredAt]);

  const peerFor = useMemo(() => {
    return (identity: string): CallPeer | undefined =>
      call.participants?.[identity] ||
      (call.peer?.uid === identity ? call.peer : undefined);
  }, [call.participants, call.peer]);

  const tiles = remoteParticipants.map((participant) => {
    const ref = cameraRefs.find(
      (track) => track.participant.identity === participant.identity
    );
    const hasVideo = !!(ref?.publication?.track && !ref.publication.isMuted);
    const peer = peerFor(participant.identity);
    const name = peer?.name || participant.name || "ተሳታፊ";
    return { participant, ref, hasVideo, peer, name };
  });

  const localCameraRef = cameraRefs.find(
    (track) => track.participant.identity === localParticipant.identity
  );

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {}
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {}
  };

  const toggleSpeaker = async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    await setNativeSpeaker(next);
  };

  const stage = tiles[0];
  const tray = tiles.slice(1, 7);
  const overflow = tiles.slice(7);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onMinimize ? (
            <TouchableOpacity
              onPress={onMinimize}
              style={styles.minimizeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Minimize call"
            >
              <ChevronDown color="#F8FAFC" size={24} />
            </TouchableOpacity>
          ) : null}
          <View>
            <Text style={styles.badge}>
              {call.isGroup ? "✞ የጋራ ቤት ምክክር" : "✞ የቪዲዮ ምክክር"}
            </Text>
            <Text style={styles.peerName}>
              {call.peer?.name || (call.isGroup ? "የቤተሰብ ምክክር" : "የንስሐ አባል")}
            </Text>
            <Text style={styles.peerRole}>{callRoleLabel(call.peer?.role)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.duration}>{elapsed}</Text>
          <Text style={styles.participants}>
            {remoteParticipants.length + 1} ተሳታፊዎች
          </Text>
        </View>
      </View>
      <Text style={styles.security}>ይህ ጥሪ በሚስጥር የተጠበቀ ነው</Text>

      <View style={styles.stageWrap}>
        {stage ? (
          <View style={styles.stageTile}>
            {stage.hasVideo && stage.ref ? (
              <VideoTrack
                trackRef={stage.ref}
                style={styles.video}
                objectFit="cover"
              />
            ) : (
              <View style={styles.cameraOffTile}>
                <PeerPhoto peer={stage.peer} name={stage.name} size={112} />
                <Text style={styles.tileName}>{stage.name || "ተሳታፊ"}</Text>
                <Text style={styles.tileRole}>{callRoleLabel(stage.peer?.role)}</Text>
                <Text style={styles.cameraOff}>ካሜራ ጠፍቷል</Text>
              </View>
            )}
            <View style={styles.nameBadge}>
              <Text style={styles.nameBadgeText} numberOfLines={1}>
                {stage.name || "ተሳታፊ"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.waiting}>
            <PeerPhoto peer={call.peer} name={call.peer?.name} size={104} />
            <Text style={styles.waitingTitle}>
              {call.peer?.name || (call.isGroup ? "የቤተሰብ ምክክር" : "የንስሐ አባል")}
            </Text>
            <Text style={styles.waitingSub}>{callRoleLabel(call.peer?.role)}</Text>
            <Text style={styles.cameraOff}>ተሳታፊዎችን በመጠበቅ ላይ…</Text>
          </View>
        )}

        {localCameraRef?.publication?.track && isCameraEnabled ? (
          <View style={styles.localPreview}>
            <VideoTrack
              trackRef={localCameraRef}
              style={styles.localVideo}
              objectFit="cover"
            />
          </View>
        ) : (
          <View style={[styles.localPreview, styles.localOffline]}>
            <Text style={styles.localOfflineText}>እርስዎ</Text>
          </View>
        )}
      </View>

      {tray.length > 0 && (
        <ScrollView horizontal style={styles.tray} showsHorizontalScrollIndicator={false}>
          {tray.map((tile) => (
            <View key={tile.participant.identity} style={styles.trayTile}>
              {tile.hasVideo && tile.ref ? (
                <VideoTrack trackRef={tile.ref} style={styles.trayVideo} objectFit="cover" />
              ) : (
                <View style={styles.trayOffline}>
                  <PeerPhoto peer={tile.peer} name={tile.name} size={42} />
                  <Text style={styles.trayName} numberOfLines={1}>
                    {tile.name}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {overflow.length > 0 && (
        <View style={styles.overflow}>
          {overflow.map((tile) => (
            <View key={tile.participant.identity} style={styles.overflowPill}>
              <User size={12} color="#D97706" />
              <Text style={styles.overflowText} numberOfLines={1}>
                {tile.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.control, !isMicrophoneEnabled && styles.controlOff]}
          onPress={toggleMic}
        >
          {isMicrophoneEnabled ? (
            <Mic color="#FFFFFF" size={22} />
          ) : (
            <MicOff color="#EF4444" size={22} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, !isCameraEnabled && styles.controlOff]}
          onPress={toggleCamera}
        >
          {isCameraEnabled ? (
            <VideoIcon color="#FFFFFF" size={22} />
          ) : (
            <VideoOff color="#EF4444" size={22} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, !isSpeakerOn && styles.controlOff]}
          onPress={toggleSpeaker}
        >
          {isSpeakerOn ? (
            <Volume2 color="#FFFFFF" size={22} />
          ) : (
            <VolumeX color="#EF4444" size={22} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.control, styles.end]} onPress={onEndCall}>
          <PhoneOff color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1120", paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  minimizeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { color: "#D97706", fontSize: 12, fontWeight: "800" },
  peerName: { color: "#F8FAFC", fontSize: 20, fontWeight: "700", marginTop: 4 },
  peerRole: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  duration: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  participants: { color: "#94A3B8", fontSize: 11, marginTop: 3 },
  security: { color: "#64748B", fontSize: 10, marginTop: 6, textAlign: "center" },
  stageWrap: { flex: 1, marginTop: 12, position: "relative" },
  stageTile: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111C33",
    justifyContent: "center",
    alignItems: "center",
  },
  video: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cameraOffTile: { alignItems: "center", justifyContent: "center", padding: 16 },
  photo: { borderWidth: 3, borderColor: "#D97706" },
  initialCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
    borderWidth: 3,
    borderColor: "#D97706",
  },
  initialText: { color: "#F8FAFC", fontWeight: "800" },
  tileName: { color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 12 },
  tileRole: { color: "#D97706", fontSize: 12, marginTop: 3 },
  cameraOff: { color: "#94A3B8", fontSize: 11, marginTop: 6 },
  nameBadge: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "rgba(2,6,23,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: "70%",
  },
  nameBadgeText: { color: "#F8FAFC", fontSize: 12, fontWeight: "700" },
  waiting: { flex: 1, alignItems: "center", justifyContent: "center" },
  waitingTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "700", marginTop: 12 },
  waitingSub: { color: "#D97706", fontSize: 12, marginTop: 3 },
  localPreview: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 96,
    height: 132,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  localVideo: { width: "100%", height: "100%" },
  localOffline: { backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  localOfflineText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  tray: { maxHeight: 112, marginTop: 10 },
  trayTile: { width: 92, height: 92, borderRadius: 12, overflow: "hidden", marginRight: 8, backgroundColor: "#111C33" },
  trayVideo: { width: "100%", height: "100%" },
  trayOffline: { flex: 1, alignItems: "center", justifyContent: "center" },
  trayName: { color: "#CBD5E1", fontSize: 10, marginTop: 4, maxWidth: 86, textAlign: "center" },
  overflow: { flexDirection: "row", marginTop: 8 },
  overflowPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111C33",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    maxWidth: 120,
  },
  overflowText: { color: "#CBD5E1", fontSize: 10, marginLeft: 4 },
  controls: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 18 },
  control: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  controlOff: { backgroundColor: "#331C24" },
  end: { backgroundColor: "#DC2626" },
});
