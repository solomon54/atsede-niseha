// mobile/app/settings.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Key,
  Lock,
  LogOut,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react-native";

import { apiRequest } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { THEME } from "../src/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { role, logout, eotcUid } = useAuth();
  const isFather = role === "FATHER";

  // Notification Toggles
  const [notifyAppointments, setNotifyAppointments] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [acceptingRequests, setAcceptingRequests] = useState(true);

  // Password Change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("ስህተት", "እባክዎ ሁሉንም የይለፍ ቃል ሳጥኖች ይሙሉ");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("ስህተት", "አዲሱ የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("ስህተት", "አዲሶቹ የይለፍ ቃሎች አይመሳሰሉም");
      return;
    }

    try {
      setPwLoading(true);
      const res = await apiRequest<{ success: boolean; message?: string }>(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );

      if (res?.success) {
        setPwSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        Alert.alert("ተሳክቷል", "የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል ✞");
      } else {
        Alert.alert("ስህተት", res?.message || "የይለፍ ቃል መቀየር አልተሳካም");
      }
    } catch (err: any) {
      Alert.alert(
        "ስህተት",
        err?.message || "የይለፍ ቃሉን መቀየር አልተቻለም። የቀድሞው ትክክል መሆኑን ያረጋግጡ።"
      );
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "ከመለያ መውጣት",
      "እርግጠኛ ነዎት ከመለያዎ መውጣት ይፈልጋሉ?",
      [
        { text: "ይቅር", style: "cancel" },
        {
          text: "ውጣ",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={20} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>ቅንብሮች</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Pastoral Ministry Toggles (Father only) */}
        {isFather && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <UserCheck color={THEME.colors.sacredAmber} size={16} />
              <Text style={styles.sectionTitle}>የአገልግሎት ሁኔታ</Text>
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleTitle}>አዳዲስ የንስሐ ቀጠሮዎችን መቀበል</Text>
                <Text style={styles.toggleSubtitle}>
                  ይህ ሲበራ ልጆች አዳዲስ የንስሐ ቀጠሮዎችን መጠየቅ ይችላሉ
                </Text>
              </View>
              <Switch
                value={acceptingRequests}
                onValueChange={setAcceptingRequests}
                trackColor={{
                  false: THEME.colors.surfaceAlt,
                  true: THEME.colors.success,
                }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Bell color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>ማሳወቂያዎች (NOTIFICATIONS)</Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextBlock}>
              <Text style={styles.toggleTitle}>የቀጠሮ ማሳወቂያዎች</Text>
              <Text style={styles.toggleSubtitle}>
                ቀጠሮ ሲጠየቅ፣ ሲረጋገጥ ወይም ሲቀየር ማሳወቂያ ይደርስዎታል
              </Text>
            </View>
            <Switch
              value={notifyAppointments}
              onValueChange={setNotifyAppointments}
              trackColor={{
                false: THEME.colors.surfaceAlt,
                true: THEME.colors.success,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.toggleRow, styles.borderTop]}>
            <View style={styles.toggleTextBlock}>
              <Text style={styles.toggleTitle}>የመልዕክት ማሳወቂያዎች</Text>
              <Text style={styles.toggleSubtitle}>
                አዲስ መንፈሳዊ መልዕክት ሲደርስዎት ፈጣን ማሳወቂያ ይደርሳል
              </Text>
            </View>
            <Switch
              value={notifyMessages}
              onValueChange={setNotifyMessages}
              trackColor={{
                false: THEME.colors.surfaceAlt,
                true: THEME.colors.success,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Security & Password Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Lock color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.sectionTitle}>የመለያ ደህንነት (SECURITY)</Text>
          </View>

          <TouchableOpacity
            style={styles.pwHeaderRow}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pwHeaderTitle}>የይለፍ ቃል መቀየር</Text>
              <Text style={styles.pwHeaderSubtitle}>
                መለያዎን ደህንነቱ የተጠበቀ ለማድረግ የይለፍ ቃል ይቀይሩ
              </Text>
            </View>
            <Text style={styles.pwActionToggle}>
              {showPasswordSection ? "ዝጋ" : "ቀይር"}
            </Text>
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.pwFormArea}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>የአሁኑ የይለፍ ቃል *</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  placeholder="የአሁኑ የይለፍ ቃል"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>አዲስ የይለፍ ቃል *</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  placeholder="ቢያንስ 6 ፊደላት"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>አዲሱን የይለፍ ቃል አረጋግጥ *</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  placeholder="አዲሱን ደግመው ያስገቡ"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.showPwRow}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff color={THEME.colors.inkMuted} size={16} />
                ) : (
                  <Eye color={THEME.colors.inkMuted} size={16} />
                )}
                <Text style={styles.showPwText}>
                  {showPassword ? "የይለፍ ቃል ደብቅ" : "የይለፍ ቃል አሳይ"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.savePwBtn}
                onPress={handlePasswordChange}
                disabled={pwLoading}
              >
                {pwLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.savePwBtnText}>የይለፍ ቃል አድስ</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Privacy & Encryption Badges */}
          <View style={[styles.privacyBox, styles.borderTop]}>
            <View style={styles.privacyItem}>
              <ShieldCheck color={THEME.colors.success} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyTitle}>የስክሪን ደህንነት (FLAG_SECURE)</Text>
                <Text style={styles.privacySub}>
                  የስክሪን ቅጂ (Screenshot) ተከልክሏል።
                </Text>
              </View>
            </View>

            <View style={[styles.privacyItem, { marginTop: 10 }]}>
              <Shield color={THEME.colors.sacredAmber} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyTitle}>ምስጢራዊነት (E2EE Active)</Text>
                <Text style={styles.privacySub}>
                  መልዕክቶች በPBKDF2-SHA256 እና AES-256-GCM የተጠበቁ ናቸው።
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* System Info & Sign Out */}
        <View style={styles.systemInfoBox}>
          <Text style={styles.systemInfoTitle}>ዐጸደ ንስሐ • SANCTUARY</Text>
          <Text style={styles.systemInfoSubtitle}>
            የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተክርስቲያን መንፈሳዊ ሥርዓት • Version 1.0.0
          </Text>
          <Text style={styles.eotcBadge}>መለያ ቁጥር፡ {eotcUid || "—"}</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut color={THEME.colors.sacredCrimson} size={18} />
          <Text style={styles.logoutBtnText}>ከመለያ ውጣ (SIGN OUT)</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.navigationBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  navBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  navBackText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  toggleTextBlock: {
    flex: 1,
    paddingRight: 14,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  toggleSubtitle: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    marginTop: 10,
    paddingTop: 12,
  },
  pwHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  pwHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  pwHeaderSubtitle: {
    fontSize: 11,
    color: THEME.colors.inkMuted,
    marginTop: 2,
  },
  pwActionToggle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
  },
  pwFormArea: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
  },
  showPwRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  showPwText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  savePwBtn: {
    backgroundColor: THEME.colors.buttonDark,
    paddingVertical: 12,
    borderRadius: THEME.radii.pill,
    alignItems: "center",
  },
  savePwBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  privacyBox: {
    paddingTop: 12,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  privacyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  privacySub: {
    fontSize: 10,
    color: THEME.colors.inkMuted,
    marginTop: 1,
  },
  systemInfoBox: {
    alignItems: "center",
    marginVertical: 16,
  },
  systemInfoTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1,
  },
  systemInfoSubtitle: {
    fontSize: 10,
    color: THEME.colors.inkMuted,
    marginTop: 4,
    textAlign: "center",
  },
  eotcBadge: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    marginTop: 6,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    letterSpacing: 0.5,
  },
});

