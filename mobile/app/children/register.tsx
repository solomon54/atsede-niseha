// mobile/app/children/register.tsx
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
import { copyToClipboard } from "../../src/lib/clipboard";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  GraduationCap,
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
import { THEME } from "../../src/constants/theme";

const ETHIOPIAN_MONTHS = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ",
];

const SPIRITUAL_TITLES = [
  "ምዕመን / ምዕመናት",
  "ዲያቆን",
  "ቀሲስ",
  "መሪጌታ",
  "ዘማሪ / ዘማሪት",
  "መምህር",
];

const COMMON_LANGUAGES = [
  "አማርኛ",
  "አፋን ኦሮሞ",
  "ትግርኛ",
  "ወላይትኛ",
  "ሲዳምኛ",
  "ጉራጊኛ",
  "ሃዲይኛ",
  "ጋሞኛ",
  "ሶማሊኛ",
  "አፋርኛ",
  "እንግሊዝኛ",
];

const ETHIOPIAN_REGIONS = [
  "አዲስ አበባ",
  "ድሬዳዋ",
  "ኦሮሚያ",
  "አማራ",
  "ትግራይ",
  "ሲዳማ",
  "ደቡብ ኢትዮጵያ",
  "ማዕከላዊ ኢትዮጵያ",
  "ደቡብ ምዕራብ ኢትዮጵያ",
  "ሶማሌ",
  "ቤንሻንጉል ጉሙዝ",
  "አፋር",
  "ጋምቤላ",
  "ሐረሪ",
];

export default function RegisterChildScreen() {
  const router = useRouter();
  const { eotcUid, uid } = useAuth();

  // Form State
  const [token, setToken] = useState("");
  const [secularName, setSecularName] = useState("");
  const [christianName, setChristianName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [birthYear, setBirthYear] = useState("1996");
  const [birthMonth, setBirthMonth] = useState("1");
  const [birthDay, setBirthDay] = useState("1");

  const [region, setRegion] = useState("አዲስ አበባ");
  const [zone, setZone] = useState("አዲስ አበባ");
  const [city, setCity] = useState("አዲስ አበባ");

  const [spiritualTitle, setSpiritualTitle] = useState("ምዕመን / ምዕመናት");
  const [language, setLanguage] = useState("አማርኛ");

  const [university, setUniversity] = useState("አዲስ አበባ ዩኒቨርሲቲ");
  const [college, setCollege] = useState("ቴክኖሎጂ ኢንስቲትዩት");
  const [department, setDepartment] = useState("ሶፍትዌር ምህንድስና");
  const [entryYear, setEntryYear] = useState("2014");
  const [programDuration, setProgramDuration] = useState("4");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState(
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400"
  );

  // Email verification state
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [emailMessage, setEmailMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // 1. Generate Holy Covenant Token
  const generateToken = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randPart = (len: number) => {
      let res = "";
      for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return res;
    };

    const prefix = eotcUid ? eotcUid.replace(/[^A-Za-z0-9]/g, "").slice(0, 5) : "AN";
    const generated = `${prefix}-${randPart(4)}-${randPart(4)}`.toUpperCase();
    setToken(generated);
  }, [eotcUid]);

  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // 2. Debounced real-time email verification
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailStatus("idle");
      setEmailMessage("");
      return;
    }

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setEmailStatus("invalid");
      setEmailMessage("ትክክለኛ ኢሜይል ያስገቡ (example@domain.com)");
      return;
    }

    setEmailStatus("checking");
    setEmailMessage("ኢሜይሉን በማረጋገጥ ላይ...");

    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{
          valid: boolean;
          message?: string;
          code?: string;
        }>("/api/email/verify", {
          method: "POST",
          body: JSON.stringify({ email: trimmed }),
        });

        if (res?.valid) {
          setEmailStatus("valid");
          setEmailMessage("ኢሜይሉ ተረጋግጧል ✞ (Verified)");
        } else {
          setEmailStatus("invalid");
          setEmailMessage(res?.message || "የተሳሳተ ወይም የማይሰራ ኢሜይል አድራሻ");
        }
      } catch (err: any) {
        setEmailStatus("invalid");
        setEmailMessage(err?.message || "ኢሜይሉን ማረጋገጥ አልተቻለም");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async () => {
    if (!secularName.trim()) {
      Alert.alert("ስህተት", "እባክዎ የልጁን ሙሉ የዓለም ስም ያስገቡ።");
      return;
    }
    if (!christianName.trim()) {
      Alert.alert("ስህተት", "እባክዎ የልጁን የክርስትና ስም ያስገቡ።");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("ስህተት", "እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ።");
      return;
    }
    if (!email.trim() || emailStatus !== "valid") {
      Alert.alert(
        "ስህተት",
        emailMessage || "እባክዎ የተረጋገጠ እና የሚሰራ ኢሜይል ያስገቡ።"
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        fatherId: uid,
        data: {
          fullToken: token,
          secularName: secularName.trim(),
          christianName: christianName.trim(),
          gender,
          birthDate: {
            day: Number(birthDay) || 1,
            month: Number(birthMonth) || 1,
            year: Number(birthYear) || 1996,
          },
          region,
          zone,
          city: city.trim(),
          spiritualTitle,
          spiritualFatherId: eotcUid,
          language,
          university,
          college,
          department: department.trim(),
          entryYear: Number(entryYear) || 2014,
          programDuration: Number(programDuration) || 4,
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          photoUrl,
        },
      };

      const res = await apiRequest<{
        success: boolean;
        studentId: string;
        fullToken: string;
      }>("/api/father/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        setSuccessToken(token);
      } else {
        Alert.alert("ስህተት", "ልጁን መመዝገብ አልተቻለም። እባክዎ እንደገና ይሞክሩ።");
      }
    } catch (err: any) {
      Alert.alert(
        "የምዝገባ ስህተት",
        err?.message || "የመረብ ወይም የሲስተም ስህተት አጋጥሟል።"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySuccessToken = async () => {
    if (!successToken) return;
    await copyToClipboard(successToken, "የቃል ኪዳን ቁልፍ");
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleDone = () => {
    router.replace("/(tabs)/children" as any);
  };

  // Success Modal / Screen
  if (successToken) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <CheckCircle2 color={THEME.colors.success} size={48} />
          </View>
          <Text style={styles.successTitle}>ምዝገባው ተሳክቷል! ✞</Text>
          <Text style={styles.successSubtitle}>
            መንፈሳዊ ልጁ በአባታችን ስም በተሳካ ሁኔታ ተመዝግቧል። የቃል ኪዳን ቁልፉ ወደ ኢሜይላቸው
            ተልኳል።
          </Text>

          <View style={styles.tokenBox}>
            <Text style={styles.tokenBoxLabel}>የቃል ኪዳን ቁልፍ (COVENANT TOKEN)</Text>
            <Text style={styles.tokenBoxValue}>{successToken}</Text>
          </View>

          <TouchableOpacity
            style={styles.copyTokenBtn}
            onPress={handleCopySuccessToken}
          >
            <Copy
              color={
                tokenCopied
                  ? THEME.colors.success
                  : THEME.colors.sacredAmber
              }
              size={18}
            />
            <Text
              style={[
                styles.copyTokenBtnText,
                tokenCopied && { color: THEME.colors.success },
              ]}
            >
              {tokenCopied ? "ቁልፉ ተቀድቷል ✓" : "ቁልፉን ቅዳ"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.finishBtn} onPress={handleDone}>
            <Text style={styles.finishBtnText}>ወደ መንጋዬ ተመለስ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        <Text style={styles.navTitle}>አዲስ ልጅ መመዝገብ</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Token Sanctuary Card */}
        <View style={styles.tokenSection}>
          <View style={styles.tokenHeader}>
            <Key color={THEME.colors.sacredAmber} size={18} />
            <Text style={styles.tokenSectionTitle}>የቃል ኪዳን ቁልፍ (COVENANT TOKEN)</Text>
            <TouchableOpacity onPress={generateToken} style={styles.tokenRefreshBtn}>
              <RefreshCcw color={THEME.colors.sacredAmber} size={14} />
            </TouchableOpacity>
          </View>
          <Text style={styles.tokenDisplay}>{token}</Text>
          <Text style={styles.tokenHint}>
            ይህ ልዩ መለያ ለልጁ ወደ ሲስተሙ መግቢያ ሆኖ የሚያገለግል የቃል ኪዳን ቁልፍ ነው።
          </Text>
        </View>

        {/* Section 1: የማንነት መረጃ */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <User color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የማንነት መረጃ (IDENTITY)</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የዓለም መጠሪያ ስም (ሙሉ ስም) *</Text>
            <TextInput
              style={styles.input}
              placeholder="ለምሳሌ፡ ሰሎሞን ፀሐይ"
              placeholderTextColor={THEME.colors.inkSubtle}
              value={secularName}
              onChangeText={setSecularName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የክርስትና ስም *</Text>
            <TextInput
              style={[styles.input, styles.holyInput]}
              placeholder="ለምሳሌ፡ ወልደ ማርያም"
              placeholderTextColor={THEME.colors.sacredAmber}
              value={christianName}
              onChangeText={setChristianName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ጾታ *</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  gender === "MALE" && styles.toggleBtnActive,
                ]}
                onPress={() => setGender("MALE")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    gender === "MALE" && styles.toggleBtnTextActive,
                  ]}
                >
                  ወንድ (MALE)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  gender === "FEMALE" && styles.toggleBtnActive,
                ]}
                onPress={() => setGender("FEMALE")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    gender === "FEMALE" && styles.toggleBtnTextActive,
                  ]}
                >
                  ሴት (FEMALE)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የተወለዱበት ዓመት (በኢትዮጵያ ዓ.ም)</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="ዓመት"
                keyboardType="numeric"
                value={birthYear}
                onChangeText={setBirthYear}
              />
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="ወር"
                keyboardType="numeric"
                value={birthMonth}
                onChangeText={setBirthMonth}
              />
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="ቀን"
                keyboardType="numeric"
                value={birthDay}
                onChangeText={setBirthDay}
              />
            </View>
          </View>
        </View>

        {/* Section 2: የትምህርትና መንፈሳዊ መረጃ */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <GraduationCap color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.sectionTitle}>የትምህርትና መንፈሳዊ መረጃ</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>መንፈሳዊ ማዕረግ</Text>
            <TextInput
              style={styles.input}
              placeholder="ምዕመን / ዲያቆን"
              value={spiritualTitle}
              onChangeText={setSpiritualTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ዩኒቨርሲቲ / ተቋም</Text>
            <TextInput
              style={styles.input}
              placeholder="የሚማሩበት ዩኒቨርሲቲ"
              value={university}
              onChangeText={setUniversity}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ኮሌጅ / ኢንስቲትዩት</Text>
            <TextInput
              style={styles.input}
              placeholder="ኮሌጅ"
              value={college}
              onChangeText={setCollege}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የትምህርት ክፍል (ዲፓርትመንት)</Text>
            <TextInput
              style={styles.input}
              placeholder="የትምህርት ክፍል"
              value={department}
              onChangeText={setDepartment}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>የመግቢያ ዓ.ም</Text>
              <TextInput
                style={styles.input}
                placeholder="2014"
                keyboardType="numeric"
                value={entryYear}
                onChangeText={setEntryYear}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ቆይታ (ዓመታት)</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                keyboardType="numeric"
                value={programDuration}
                onChangeText={setProgramDuration}
              />
            </View>
          </View>
        </View>

        {/* Section 3: የመገናኛና የመኖሪያ አድራሻ */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Phone color={THEME.colors.success} size={16} />
            <Text style={styles.sectionTitle}>የመገናኛና የመኖሪያ አድራሻ</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ስልክ ቁጥር *</Text>
            <TextInput
              style={styles.input}
              placeholder="0911234567"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Email with Live Deliverability Verification */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ኢሜይል አድራሻ (የሚሰራ ኢሜይል) *</Text>
            <View style={styles.emailInputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.emailInput,
                  emailStatus === "valid" && styles.inputSuccess,
                  emailStatus === "invalid" && styles.inputError,
                ]}
                placeholder="ለምሳሌ፡ user@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.emailIconWrapper}>
                {emailStatus === "checking" && (
                  <ActivityIndicator size="small" color={THEME.colors.sacredAmber} />
                )}
                {emailStatus === "valid" && (
                  <CheckCircle2 color={THEME.colors.success} size={18} />
                )}
                {emailStatus === "invalid" && (
                  <XCircle color={THEME.colors.sacredCrimson} size={18} />
                )}
              </View>
            </View>
            {emailMessage ? (
              <Text
                style={[
                  styles.emailFeedback,
                  emailStatus === "valid"
                    ? styles.feedbackSuccess
                    : styles.feedbackError,
                ]}
              >
                {emailMessage}
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ክልል</Text>
              <TextInput
                style={styles.input}
                placeholder="ክልል"
                value={region}
                onChangeText={setRegion}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>ከተማ</Text>
              <TextInput
                style={styles.input}
                placeholder="ከተማ"
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (submitting || emailStatus !== "valid") && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || emailStatus !== "valid"}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Sparkles color="#FFFFFF" size={18} />
              <Text style={styles.submitBtnText}>መንፈሳዊ ልጁን መዝግብ</Text>
            </>
          )}
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
    letterSpacing: 0.2,
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
  holyInput: {
    color: THEME.colors.sacredAmber,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radii.lg,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  toggleBtnActive: {
    backgroundColor: THEME.colors.sacredCrimsonLight,
    borderColor: THEME.colors.sacredCrimson,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  toggleBtnTextActive: {
    color: THEME.colors.sacredCrimson,
    fontWeight: "900",
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateInput: {
    flex: 1,
    textAlign: "center",
    fontFamily: "monospace",
  },
  emailInputWrapper: {
    position: "relative",
  },
  emailInput: {
    paddingRight: 40,
  },
  emailIconWrapper: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  inputSuccess: {
    borderColor: THEME.colors.success,
  },
  inputError: {
    borderColor: THEME.colors.sacredCrimson,
  },
  emailFeedback: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  feedbackSuccess: {
    color: THEME.colors.success,
  },
  feedbackError: {
    color: THEME.colors.sacredCrimson,
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

