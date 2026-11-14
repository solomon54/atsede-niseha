// mobile/app/governor/authorize.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Copy,
  Globe,
  Key,
  MapPin,
  Phone,
  RefreshCcw,
  Sparkles,
  User,
  XCircle,
} from "lucide-react-native";

import { apiRequest } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { copyToClipboard } from "../../src/lib/clipboard";
import { THEME } from "../../src/constants/theme";

const SPIRITUAL_TITLES = [
  "ሊቀ ሊቃዉንት",
  "መልአከ ሰላም",
  "መልአከ መንክራት",
  "ቆሞስ",
  "ሊቀ ካህናት",
  "መጋቤ ሐዲስ",
  "ቀሲስ",
];

const AVAILABLE_LANGUAGES = [
  "አማርኛ",
  "ግዕዝ",
  "ትግርኛ",
  "Oromiffa",
  "Hadiyisa",
  "English",
];

export default function AuthorizeFatherScreen() {
  const router = useRouter();
  const { role } = useAuth();

  // Generated EOTC Key
  const [eotcUid, setEotcUid] = useState("");

  // Form Fields
  const [title, setTitle] = useState("ቀሲስ");
  const [secularTitle, setSecularTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [academics, setAcademics] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+251");
  const [diocese, setDiocese] = useState("");
  const [parish, setParish] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([
    "አማርኛ",
  ]);

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [successUid, setSuccessUid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate ID matching web logic: EOTC-XXXXXXXX
  const generateNewId = useCallback(() => {
    const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
    setEotcUid(`EOTC-${hex}`);
  }, []);

  useEffect(() => {
    generateNewId();
  }, [generateNewId]);

  const toggleLanguage = (lang: string) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const handleCopySuccessKey = async () => {
    if (!successUid) return;
    await copyToClipboard(successUid, "የአባቱ መለያ ቁልፍ");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      Alert.alert("ስህተት", "እባክዎ የአባቱን ሙሉ ስም ያስገቡ");
      return;
    }
    if (!academics.trim()) {
      Alert.alert("ስህተት", "እባክዎ የትምህርት ዝግጅታቸውን ያስገቡ");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("ስህተት", "እባክዎ ትክክለኛ ኢሜይል ያስገቡ");
      return;
    }
    if (!phone.startsWith("+251") || phone.length < 13) {
      Alert.alert(
        "ስህተት",
        "የስልክ ቁጥር በ +251 መጀመር አለበት (ለምሳሌ፡ +251911234567)"
      );
      return;
    }
    if (!diocese.trim()) {
      Alert.alert("ስህተት", "እባክዎ ሀገረ ስብከት ያስገቡ");
      return;
    }
    if (!parish.trim()) {
      Alert.alert("ስህተት", "እባክዎ ደብር/ገዳም ያስገቡ");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        uid: eotcUid,
        title,
        secularTitle: secularTitle.trim() || undefined,
        fullName: fullName.trim(),
        academics: academics.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        diocese: diocese.trim(),
        parish: parish.trim(),
        languages: selectedLanguages,
      };

      await apiRequest<{ ok: boolean }>("/api/governor/authorize", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessUid(eotcUid);
    } catch (err: any) {
      Alert.alert(
        "ምዝገባው አልተሳካም",
        err.message || "የኔትወርክ ችግር ተፈጥሯል፤ እባክዎ እንደገና ይሞክሩ።"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Success Screen
  if (successUid) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <CheckCircle2 color={THEME.colors.success} size={48} />
          </View>
          <Text style={styles.successTitle}>አባቱ በክብር ተፈቅዶላቸዋል! ✞</Text>
          <Text style={styles.successSubtitle}>
            መንፈሳዊ አባቱ በመላው ቤተክርስቲያን መዝገብ ውስጥ በይፋ ተመዝግበዋል። መለያ ቁልፋቸውን
            በመጠቀም መለያቸውን ማረጋገጥ ይችላሉ።
          </Text>

          <View style={styles.tokenBox}>
            <Text style={styles.tokenBoxLabel}>የአባቱ መለያ ቁልፍ (EOTC ID)</Text>
            <Text style={styles.tokenBoxValue}>{successUid}</Text>
          </View>

          <TouchableOpacity
            style={styles.copyTokenBtn}
            onPress={handleCopySuccessKey}
          >
            <Copy
              color={copied ? THEME.colors.success : THEME.colors.sacredAmber}
              size={18}
            />
            <Text
              style={[
                styles.copyTokenBtnText,
                copied && { color: THEME.colors.success },
              ]}
            >
              {copied ? "ቁልፉ ተቀድቷል ✓" : "ቁልፉን ቅዳ"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.finishBtn}
            onPress={() => router.replace("/(tabs)/governor" as any)}
          >
            <Text style={styles.finishBtnText}>ወደ መቆጣጠሪያው ተመለስ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
        >
          <ArrowLeft color={THEME.colors.sacredCrimson} size={20} />
          <Text style={styles.navBackText}>ተመለስ</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>አዲስ አባት ፍቃድ መስጠት</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Token Section */}
        <View style={styles.tokenSection}>
          <View style={styles.tokenHeader}>
            <Sparkles color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.tokenSectionTitle}>የተመደበላቸው ይፋዊ መለያ ቁልፍ</Text>
            <TouchableOpacity
              style={styles.tokenRefreshBtn}
              onPress={generateNewId}
            >
              <RefreshCcw color={THEME.colors.sacredAmber} size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.tokenDisplay}>{eotcUid}</Text>
          <Text style={styles.tokenHint}>
            ይህ መለያ ቁጥር ለአባቱ የሚሰጥ ሲሆን ወደ ሲስተሙ ለመግባት ይጠቀሙበታል።
          </Text>
        </View>

        {/* Section 1: መንፈሳዊ ማዕረግ እና ስም */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Award color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.sectionTitle}>መንፈሳዊ ማዕረግ እና ሙሉ ስም</Text>
          </View>

          {/* Spiritual Title Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>መንፈሳዊ ማዕረግ *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.titleChipRow}>
                {SPIRITUAL_TITLES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.titleChip,
                      title === t && styles.titleChipActive,
                    ]}
                    onPress={() => setTitle(t)}
                  >
                    <Text
                      style={[
                        styles.titleChipText,
                        title === t && styles.titleChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ሙሉ ስም (የአባቱ ስም) *</Text>
            <TextInput
              style={styles.input}
              placeholder="ለምሳሌ፡ ዮሐንስ ተክለሃይማኖት"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Secular Title / Optional */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የዓለም ማዕረግ (አስፈላጊ ከሆነ)</Text>
            <TextInput
              style={styles.input}
              placeholder="ለምሳሌ፡ ዶ/ር፣ ፕሮፌሰር"
              value={secularTitle}
              onChangeText={setSecularTitle}
            />
          </View>
        </View>

        {/* Section 2: የትምህርት ዝግጅት እና ቋንቋ */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <BookOpen color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.sectionTitle}>የትምህርት ዝግጅት እና ቋንቋዎች</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የትምህርት ዝግጅት / ጉባኤ ቤት *</Text>
            <TextInput
              style={styles.input}
              placeholder="ለምሳሌ፡ የመጽሐፍ መምህር / ቴዎሎጂ ዲግሪ"
              value={academics}
              onChangeText={setAcademics}
            />
          </View>

          {/* Languages Multi-Select */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የሚያገለግሉባቸው ቋንቋዎች *</Text>
            <View style={styles.langGrid}>
              {AVAILABLE_LANGUAGES.map((lang) => {
                const selected = selectedLanguages.includes(lang);
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.langChip,
                      selected && styles.langChipSelected,
                    ]}
                    onPress={() => toggleLanguage(lang)}
                  >
                    <Text
                      style={[
                        styles.langChipText,
                        selected && styles.langChipTextSelected,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Section 3: የመገናኛና የመኖሪያ አድራሻ */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <MapPin color={THEME.colors.success} size={16} />
            <Text style={styles.sectionTitle}>አድራሻ እና የስራ ቦታ</Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ሀገረ ስብከት *</Text>
              <TextInput
                style={styles.input}
                placeholder="ለምሳሌ፡ አዲስ አበባ"
                value={diocese}
                onChangeText={setDiocese}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ደብር / ገዳም *</Text>
              <TextInput
                style={styles.input}
                placeholder="ለምሳሌ፡ ደብረ ሊባኖስ"
                value={parish}
                onChangeText={setParish}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ስልክ ቁጥር (+251...) *</Text>
            <TextInput
              style={styles.input}
              placeholder="+251911234567"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ኢሜይል አድራሻ *</Text>
            <TextInput
              style={styles.input}
              placeholder="father@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle2 color="#FFFFFF" size={18} />
              <Text style={styles.submitBtnText}>አባቱን በይፋ መዝግብ ✞</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  tokenSection: {
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.xl,
    padding: 18,
    marginBottom: 16,
  },
  tokenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tokenSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1,
    flex: 1,
    marginLeft: 6,
  },
  tokenRefreshBtn: {
    padding: 4,
  },
  tokenDisplay: {
    fontSize: 22,
    fontWeight: "900",
    fontFamily: "monospace",
    color: "#FFFFFF",
    letterSpacing: 3,
    textAlign: "center",
    marginVertical: 6,
  },
  tokenHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 14,
  },
  formSection: {
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
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: 0.5,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    marginBottom: 6,
  },
  titleChipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  titleChip: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.pill,
  },
  titleChipActive: {
    backgroundColor: THEME.colors.sacredCrimson,
    borderColor: THEME.colors.sacredCrimson,
  },
  titleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkSecondary,
  },
  titleChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "900",
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
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  langChip: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.pill,
  },
  langChipSelected: {
    backgroundColor: THEME.colors.amberLight,
    borderColor: THEME.colors.sacredAmber,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  langChipTextSelected: {
    color: THEME.colors.sacredAmber,
    fontWeight: "900",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.colors.sacredCrimson,
    paddingVertical: 16,
    borderRadius: THEME.radii.pill,
    marginTop: 8,
    elevation: 3,
    shadowColor: THEME.colors.sacredCrimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnDisabled: {
    backgroundColor: THEME.colors.inkSubtle,
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  successScreen: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xl,
    padding: 24,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 4,
    shadowColor: THEME.colors.inkPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 12,
    color: THEME.colors.inkMuted,
    textAlign: "center",
    lineHeight: 18,
    marginVertical: 10,
  },
  tokenBox: {
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: "100%",
    alignItems: "center",
    marginVertical: 14,
  },
  tokenBoxLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  tokenBoxValue: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: "monospace",
    color: "#FFFFFF",
    letterSpacing: 3,
    marginTop: 6,
  },
  copyTokenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: THEME.radii.pill,
    marginBottom: 20,
  },
  copyTokenBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  finishBtn: {
    backgroundColor: THEME.colors.buttonDark,
    paddingVertical: 14,
    width: "100%",
    borderRadius: THEME.radii.pill,
    alignItems: "center",
  },
  finishBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});

