// mobile/app/children/register.tsx
/**
 * EOTC Sacred Ledger — Spiritual Child Registration (Mobile)
 * Full Web Parity Build:
 * ✔ Photo upload via Camera/Library with Cloudinary (/api/upload)
 * ✔ Cascading Region ➜ Zone selection from ETHIOPIAN_GEOGRAPHY
 * ✔ Cascading University ➜ College ➜ Department selection from UNIVERSITY_MASTER_MAP
 * ✔ Language selection from ETHIOPIAN_LANGUAGES
 * ✔ Ecclesiastical Spiritual Title selection (ምዕመን፣ ዲያቆን፣ ዘማሪ፣ ሰባኪ)
 * ✔ High-precision Ethiopian Date selection (Year, Month, Day) with Pagume leap year rules
 * ✔ Real-time dynamic Academic Progress preview (academicProgressFromEntry)
 * ✔ Covenant Token generation matching EOTC mixer (EOTC-...)
 * ✔ Real-time debounced email deliverability verification (/api/email/verify)
 * ✔ Clean generic placeholder: "የልጁን ሙሉ ስም እዚህ ያስገቡ"
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  GraduationCap,
  Key,
  Languages,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react-native";

import { apiRequest, apiUpload } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth-context";
import { THEME } from "../../src/constants/theme";
import { copyToClipboard } from "../../src/lib/clipboard";
import {
  ETHIOPIAN_GEOGRAPHY,
  ETHIOPIAN_LANGUAGES,
  UNIVERSITY_MASTER_MAP,
} from "@shared/constants/ethiopianData";
import {
  academicProgressFromEntry,
  ETHIOPIAN_MONTHS,
  getEthiopianMonthDays,
  getTodayEthiopian,
  isFutureEthiopianDate,
  isValidEthiopianDate,
} from "@shared/utils/calendar/ethiopianCalendar";

const SPIRITUAL_TITLES = ["ምዕመን", "ዲያቆን", "ዘማሪ", "ሰባኪ"];
const PROGRAM_DURATIONS = [2, 3, 4, 5, 6, 7, 8];

interface PickerModalConfig {
  title: string;
  options: { label: string; value: string | number }[];
  selectedValue: string | number;
  onSelect: (value: any) => void;
  searchable?: boolean;
}

export default function RegisterChildScreen() {
  const router = useRouter();
  const { eotcUid, uid } = useAuth();
  const todayEC = useMemo(() => getTodayEthiopian(), []);

  // ─────────────────────────────────────────────
  // FORM STATE
  // ─────────────────────────────────────────────
  const [token, setToken] = useState("");
  const [secularName, setSecularName] = useState("");
  const [christianName, setChristianName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");

  // Ethiopian Birth Date
  const [birthYear, setBirthYear] = useState<number>(todayEC.year - 20);
  const [birthMonth, setBirthMonth] = useState<number>(1);
  const [birthDay, setBirthDay] = useState<number>(1);

  // Ecclesiastical & Geography
  const [spiritualTitle, setSpiritualTitle] = useState("ምዕመን");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState(" አማርኛ (Amharic)");

  // Academic (Cascading)
  const [university, setUniversity] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [entryYear, setEntryYear] = useState<number>(todayEC.year);
  const [programDuration, setProgramDuration] = useState<number>(4);

  // Contact & Portrait
  const [phone, setPhone] = useState("+2519");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // Email verification state
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [emailMessage, setEmailMessage] = useState("");

  // Submitting & Completion
  const [submitting, setSubmitting] = useState(false);
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Reusable Picker Modal State
  const [pickerModal, setPickerModal] = useState<PickerModalConfig | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");

  // ─────────────────────────────────────────────
  // 1. TOKEN GENERATION (Matching Web Covenant Mixer)
  // ─────────────────────────────────────────────
  const generateToken = useCallback(() => {
    const fCore = (eotcUid || "FATH").replace("EOTC-", "").toUpperCase();
    const cSeed = Math.random().toString(16).slice(2, 6).toUpperCase();

    let mixed = "";
    let fIdx = 0;
    let cIdx = 0;

    for (let i = 0; i < 4; i++) {
      mixed +=
        (fCore[fIdx++] || "X") +
        (fCore[fIdx++] || "X") +
        (cSeed[cIdx++] || "Z");
    }

    setToken(`EOTC-${mixed}`);
  }, [eotcUid]);

  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // ─────────────────────────────────────────────
  // 2. DYNAMIC CASCADING OPTIONS
  // ─────────────────────────────────────────────

  // Region options
  const regionOptions = useMemo(
    () => Object.keys(ETHIOPIAN_GEOGRAPHY).map((r) => ({ label: r, value: r })),
    []
  );

  // Zone options based on selected region
  const zoneOptions = useMemo(() => {
    if (!region || !ETHIOPIAN_GEOGRAPHY[region]) return [];
    return (ETHIOPIAN_GEOGRAPHY[region] as string[]).map((z: string) => ({
      label: z,
      value: z,
    }));
  }, [region]);

  // University options
  const universityOptions = useMemo(
    () =>
      Object.keys(UNIVERSITY_MASTER_MAP).map((u: string) => ({
        label: u,
        value: u,
      })),
    []
  );

  // College options based on selected university
  const collegeOptions = useMemo(() => {
    if (!university) return [];
    const univData =
      UNIVERSITY_MASTER_MAP[university as keyof typeof UNIVERSITY_MASTER_MAP];
    if (!univData) return [];
    return Object.keys(univData).map((c: string) => ({ label: c, value: c }));
  }, [university]);

  // Department options based on selected college
  const departmentOptions = useMemo(() => {
    if (!university || !college) return [];
    const univData =
      UNIVERSITY_MASTER_MAP[university as keyof typeof UNIVERSITY_MASTER_MAP];
    const depts = (univData as any)?.[college];
    if (!Array.isArray(depts)) return [];
    return (depts as string[]).map((d: string) => ({ label: d, value: d }));
  }, [university, college]);

  // Language options
  const languageOptions = useMemo(
    () => (ETHIOPIAN_LANGUAGES as string[]).map((l: string) => ({ label: l, value: l })),
    []
  );

  // Entry year options (last 30 Ethiopian years)
  const entryYearOptions = useMemo(() => {
    return Array.from({ length: 30 }, (_, i: number) => todayEC.year - i).map((y: number) => ({
      label: `${y} ዓ.ም`,
      value: y,
    }));
  }, [todayEC.year]);

  // Birth year options (1900 to current year)
  const birthYearOptions = useMemo(() => {
    return Array.from(
      { length: todayEC.year - 1900 + 1 },
      (_, i: number) => todayEC.year - i
    ).map((y: number) => ({ label: `${y} ዓ.ም`, value: y }));
  }, [todayEC.year]);

  // Birth month options (13 Ethiopian months)
  const birthMonthOptions = useMemo(() => {
    return (ETHIOPIAN_MONTHS as string[]).map((m: string, idx: number) => ({
      label: `${idx + 1}. ${m}`,
      value: idx + 1,
    }));
  }, []);

  // Birth day options based on month/year (handles Pagume leap years)
  const maxBirthDays = useMemo(() => {
    if (!birthYear || !birthMonth) return 30;
    return getEthiopianMonthDays(birthYear, birthMonth);
  }, [birthYear, birthMonth]);

  const birthDayOptions = useMemo(() => {
    return Array.from({ length: maxBirthDays }, (_, i) => i + 1).map((d) => ({
      label: `${d}`,
      value: d,
    }));
  }, [maxBirthDays]);

  // Adjust day if month changed to Pagume
  useEffect(() => {
    if (birthDay > maxBirthDays) {
      setBirthDay(maxBirthDays);
    }
  }, [birthDay, maxBirthDays]);

  // ─────────────────────────────────────────────
  // 3. COMPUTED ACADEMIC PROGRESS
  // ─────────────────────────────────────────────
  const academicProgress = useMemo(() => {
    if (!entryYear || !programDuration) return null;
    return academicProgressFromEntry(entryYear, programDuration, gender);
  }, [entryYear, programDuration, gender]);

  // ─────────────────────────────────────────────
  // 4. DEBOUNCED EMAIL VERIFICATION
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 5. PHOTO SELECTION & UPLOAD
  // ─────────────────────────────────────────────
  const uploadPhotoFile = async (uri: string, name: string, type: string) => {
    try {
      setIsUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", {
        uri,
        name,
        type,
      } as any);
      formData.append("type", "student-portrait");

      const res = await apiUpload<{ ok: boolean; url: string }>(
        "/api/upload",
        formData
      );

      if (res?.url) {
        setPhotoUrl(res.url);
        setLocalPhotoUri(uri);
      } else {
        throw new Error("ስዕሉን መጫን አልተቻለም");
      }
    } catch (err: any) {
      Alert.alert("ስህተት", err.message || "የልጁን ፎቶ ወደ ሰርቨር መጫን አልተቻለም።");
      setLocalPhotoUri(null);
      setPhotoUrl("");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("ፍቃድ ያስፈልጋል", "ካሜራ ለመጠቀም ፍቃድ ይስጡ");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLocalPhotoUri(asset.uri);
        await uploadPhotoFile(
          asset.uri,
          asset.fileName || `portrait_${Date.now()}.jpg`,
          asset.mimeType || "image/jpeg"
        );
      }
    } catch (e: any) {
      Alert.alert("ስህተት", "ፎቶ ማንሳት አልተቻለም፡ " + e.message);
    }
  };

  const handlePickPhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLocalPhotoUri(asset.uri);
        await uploadPhotoFile(
          asset.uri,
          asset.fileName || `portrait_${Date.now()}.jpg`,
          asset.mimeType || "image/jpeg"
        );
      }
    } catch (e: any) {
      Alert.alert("ስህተት", "ፎቶ መምረጥ አልተቻለም፡ " + e.message);
    }
  };

  const handleRemovePhoto = () => {
    setLocalPhotoUri(null);
    setPhotoUrl("");
  };

  // ─────────────────────────────────────────────
  // 6. FORM VALIDATION & SUBMISSION
  // ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!photoUrl) {
      Alert.alert("ፎቶ ያስፈልጋል", "ፎቶ መምረጥ አለብዎት — የልጁን ምስል ያክሉ (Photo is required)");
      return;
    }
    if (!secularName.trim()) {
      Alert.alert("ስህተት", "እባክዎ የልጁን ሙሉ የዓለም ስም ያስገቡ።");
      return;
    }
    if (!christianName.trim()) {
      Alert.alert("ስህተት", "እባክዎ የልጁን የክርስትና ስም ያስገቡ።");
      return;
    }
    if (!region) {
      Alert.alert("ስህተት", "እባክዎ ክልል ይምረጡ።");
      return;
    }
    if (!zone) {
      Alert.alert("ስህተት", "እባክዎ ዞን / ክፍለ ከተማ ይምረጡ።");
      return;
    }
    if (!city.trim()) {
      Alert.alert("ስህተት", "እባክዎ የሚኖሩበትን ከተማ / ገጠር ያስገቡ።");
      return;
    }
    if (!university) {
      Alert.alert("ስህተት", "እባክዎ የሚማሩበትን ዩኒቨርሲቲ ይምረጡ።");
      return;
    }
    if (!college) {
      Alert.alert("ስህተት", "እባክዎ ኮሌጅ / ፋኩልቲ ይምረጡ።");
      return;
    }
    if (!department) {
      Alert.alert("ስህተት", "እባክዎ የትምህርት ክፍል (ዲፓርትመንት) ይምረጡ።");
      return;
    }
    if (!language) {
      Alert.alert("ስህተት", "እባክዎ የአፍ መፍቻ ቋንቋ ይምረጡ።");
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

    const birthDateObj = {
      year: birthYear,
      month: birthMonth,
      day: birthDay,
    };

    if (!isValidEthiopianDate(birthDateObj) || isFutureEthiopianDate(birthDateObj)) {
      Alert.alert("የተሳሳተ ቀን", "የተሳሳተ የልደት ቀን ተመርጧል። እባክዎ እንደገና ያረጋግጡ።");
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
          birthDate: birthDateObj,
          region,
          zone,
          city: city.trim(),
          spiritualTitle,
          spiritualFatherId: eotcUid,
          language,
          university,
          college,
          department,
          entryYear: Number(entryYear),
          programDuration: Number(programDuration),
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

  // Open modal helper
  const openPicker = (config: PickerModalConfig) => {
    setPickerSearchQuery("");
    setPickerModal(config);
  };

  // Filtered modal options
  const filteredPickerOptions = useMemo(() => {
    if (!pickerModal) return [];
    if (!pickerSearchQuery.trim()) return pickerModal.options;
    const q = pickerSearchQuery.toLowerCase().trim();
    return pickerModal.options.filter((o) =>
      o.label.toLowerCase().includes(q)
    );
  }, [pickerModal, pickerSearchQuery]);

  // ─────────────────────────────────────────────
  // SUCCESS CELEBRATION SCREEN
  // ─────────────────────────────────────────────
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
            activeOpacity={0.8}
          >
            <Copy
              color={
                tokenCopied ? THEME.colors.success : THEME.colors.sacredAmber
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

          <TouchableOpacity
            style={styles.finishBtn}
            onPress={handleDone}
            activeOpacity={0.8}
          >
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
      {/* Top Navigation */}
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── PORTRAIT PICKER ── */}
        <View style={styles.portraitSection}>
          <TouchableOpacity
            style={[
              styles.avatarContainer,
              !localPhotoUri && !photoUrl && styles.avatarEmpty,
            ]}
            onPress={() => setShowPhotoOptions(true)}
            activeOpacity={0.8}
          >
            {localPhotoUri || photoUrl ? (
              <Image
                source={{ uri: localPhotoUri || photoUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Camera color={THEME.colors.sacredAmber} size={32} />
                <Text style={styles.avatarEmptyLabel}>ምስል ያክሉ</Text>
              </View>
            )}

            {isUploadingPhoto && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
          </TouchableOpacity>

          {(localPhotoUri || photoUrl) && (
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={handleRemovePhoto}
              activeOpacity={0.7}
            >
              <Trash2 color="#EF4444" size={14} />
              <Text style={styles.removePhotoText}>ምስሉን አስወግድ</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.portraitHint}>
            የልጁን የፊት ገጽታ የሚያሳይ ጥርት ያለ ምስል ይምረጡ *
          </Text>
        </View>

        {/* ── COVENANT TOKEN SANCTUARY ── */}
        <View style={styles.tokenSection}>
          <View style={styles.tokenHeader}>
            <Key color={THEME.colors.sacredAmber} size={16} />
            <Text style={styles.tokenSectionTitle}>የቃል ኪዳን ቁልፍ (COVENANT TOKEN)</Text>
            <TouchableOpacity
              onPress={generateToken}
              style={styles.tokenRefreshBtn}
              hitSlop={8}
            >
              <RefreshCcw color={THEME.colors.sacredAmber} size={14} />
            </TouchableOpacity>
          </View>
          <Text style={styles.tokenDisplay}>{token}</Text>
          <Text style={styles.tokenHint}>
            ይህ ልዩ መለያ ለልጁ ወደ ሲስተሙ መግቢያ ሆኖ የሚያገለግል የቃል ኪዳን ቁልፍ ነው።
          </Text>
        </View>

        {/* ── SECTION 1: የማንነት መረጃ (IDENTITY) ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <User color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የማንነት መረጃ (IDENTITY)</Text>
          </View>

          {/* Full Secular Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የዓለም መጠሪያ ስም (ሙሉ ስም) *</Text>
            <TextInput
              style={styles.input}
              placeholder="የልጁን ሙሉ ስም እዚህ ያስገቡ"
              placeholderTextColor={THEME.colors.inkSubtle}
              value={secularName}
              onChangeText={setSecularName}
            />
          </View>

          {/* Christian Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ስመ ክርስትና (የመጽሐፍ ስም) *</Text>
            <TextInput
              style={[styles.input, styles.holyInput]}
              placeholder="ስመ ክርስትና (ለምሳሌ፡ ወልደ ማርያም)"
              placeholderTextColor={THEME.colors.sacredAmber}
              value={christianName}
              onChangeText={setChristianName}
            />
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ጾታ *</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  gender === "MALE" && styles.toggleBtnActive,
                ]}
                onPress={() => setGender("MALE")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    gender === "MALE" && styles.toggleBtnTextActive,
                  ]}
                >
                  ወንድ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  gender === "FEMALE" && styles.toggleBtnActive,
                ]}
                onPress={() => setGender("FEMALE")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    gender === "FEMALE" && styles.toggleBtnTextActive,
                  ]}
                >
                  ሴት
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Ethiopian Birth Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              የትውልድ ቀን (በኢትዮጵያ የዘመን አቆጣጠር) *
            </Text>
            <View style={styles.dateSelectorsRow}>
              {/* Year */}
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() =>
                  openPicker({
                    title: "የትውልድ ዓመት ይምረጡ",
                    options: birthYearOptions,
                    selectedValue: birthYear,
                    onSelect: (val) => setBirthYear(Number(val)),
                    searchable: true,
                  })
                }
              >
                <Text style={styles.dateSelectorText}>{birthYear} ዓ.ም</Text>
                <ChevronDown size={14} color={THEME.colors.inkSubtle} />
              </TouchableOpacity>

              {/* Month */}
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() =>
                  openPicker({
                    title: "የትውልድ ወር ይምረጡ",
                    options: birthMonthOptions,
                    selectedValue: birthMonth,
                    onSelect: (val) => setBirthMonth(Number(val)),
                  })
                }
              >
                <Text style={styles.dateSelectorText}>
                  {ETHIOPIAN_MONTHS[birthMonth - 1]}
                </Text>
                <ChevronDown size={14} color={THEME.colors.inkSubtle} />
              </TouchableOpacity>

              {/* Day */}
              <TouchableOpacity
                style={styles.dateSelectorBtn}
                onPress={() =>
                  openPicker({
                    title: "የትውልድ ቀን ይምረጡ",
                    options: birthDayOptions,
                    selectedValue: birthDay,
                    onSelect: (val) => setBirthDay(Number(val)),
                  })
                }
              >
                <Text style={styles.dateSelectorText}>{birthDay} ቀን</Text>
                <ChevronDown size={14} color={THEME.colors.inkSubtle} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Spiritual Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>መንፈሳዊ ማዕረግ *</Text>
            <TouchableOpacity
              style={styles.selectTrigger}
              onPress={() =>
                openPicker({
                  title: "መንፈሳዊ ማዕረግ ይምረጡ",
                  options: SPIRITUAL_TITLES.map((t) => ({
                    label: t,
                    value: t,
                  })),
                  selectedValue: spiritualTitle,
                  onSelect: (val) => setSpiritualTitle(val),
                })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.selectTriggerText}>{spiritualTitle}</Text>
              <ChevronDown size={16} color={THEME.colors.sacredAmber} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SECTION 2: የመኖሪያ አድራሻ (GEOGRAPHY) ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <MapPin color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የመኖሪያ አድራሻ (GEOGRAPHY)</Text>
          </View>

          {/* Region */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ክልል *</Text>
            <TouchableOpacity
              style={styles.selectTrigger}
              onPress={() =>
                openPicker({
                  title: "ክልል ይምረጡ",
                  options: regionOptions,
                  selectedValue: region,
                  onSelect: (val) => {
                    setRegion(val);
                    setZone(""); // Clear cascading zone
                  },
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !region && styles.selectTriggerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {region || "ክልል ይምረጡ..."}
              </Text>
              <ChevronDown size={16} color={THEME.colors.sacredAmber} />
            </TouchableOpacity>
          </View>

          {/* Zone (Cascading) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ዞን / ክፍለ ከተማ *</Text>
            <TouchableOpacity
              style={[
                styles.selectTrigger,
                !region && styles.selectTriggerDisabled,
              ]}
              disabled={!region}
              onPress={() =>
                openPicker({
                  title: "ዞን / ክፍለ ከተማ ይምረጡ",
                  options: zoneOptions,
                  selectedValue: zone,
                  onSelect: (val) => setZone(val),
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !zone && styles.selectTriggerPlaceholder,
                  !region && styles.selectTriggerDisabledText,
                ]}
                numberOfLines={1}
              >
                {zone || (region ? "ዞን ይምረጡ..." : "በመጀመሪያ ክልል ይምረጡ")}
              </Text>
              <ChevronDown
                size={16}
                color={!region ? THEME.colors.border : THEME.colors.sacredAmber}
              />
            </TouchableOpacity>
          </View>

          {/* City */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የሚኖሩበት ከተማ / ገጠር *</Text>
            <TextInput
              style={styles.input}
              placeholder="ከተማ/ የመኖሪያ አድራሻ"
              placeholderTextColor={THEME.colors.inkSubtle}
              value={city}
              onChangeText={setCity}
            />
          </View>
        </View>

        {/* ── SECTION 3: የትምህርት መረጃ (ACADEMIC) ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <GraduationCap color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የትምህርት መረጃ (ACADEMIC)</Text>
          </View>

          {/* University */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              የሚማሩበት ከፍተኛ ትምህርት ተቋም / ዩኒቨርሲቲ *
            </Text>
            <TouchableOpacity
              style={styles.selectTrigger}
              onPress={() =>
                openPicker({
                  title: "ዩኒቨርሲቲ ይምረጡ",
                  options: universityOptions,
                  selectedValue: university,
                  onSelect: (val) => {
                    setUniversity(val);
                    setCollege(""); // Reset cascade
                    setDepartment("");
                  },
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !university && styles.selectTriggerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {university || "ተቋም ይምረጡ..."}
              </Text>
              <ChevronDown size={16} color={THEME.colors.sacredAmber} />
            </TouchableOpacity>
          </View>

          {/* College (Cascading) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ኮሌጅ / ፋኩልቲ *</Text>
            <TouchableOpacity
              style={[
                styles.selectTrigger,
                !university && styles.selectTriggerDisabled,
              ]}
              disabled={!university}
              onPress={() =>
                openPicker({
                  title: "ኮሌጅ / ፋኩልቲ ይምረጡ",
                  options: collegeOptions,
                  selectedValue: college,
                  onSelect: (val) => {
                    setCollege(val);
                    setDepartment(""); // Reset cascade
                  },
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !college && styles.selectTriggerPlaceholder,
                  !university && styles.selectTriggerDisabledText,
                ]}
                numberOfLines={1}
              >
                {college ||
                  (university ? "ኮሌጅ ይምረጡ..." : "በመጀመሪያ ዩኒቨርሲቲ ይምረጡ")}
              </Text>
              <ChevronDown
                size={16}
                color={
                  !university ? THEME.colors.border : THEME.colors.sacredAmber
                }
              />
            </TouchableOpacity>
          </View>

          {/* Department (Cascading) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የትምህርት ክፍል (ዲፓርትመንት) *</Text>
            <TouchableOpacity
              style={[
                styles.selectTrigger,
                !college && styles.selectTriggerDisabled,
              ]}
              disabled={!college}
              onPress={() =>
                openPicker({
                  title: "የትምህርት ክፍል ይምረጡ",
                  options: departmentOptions,
                  selectedValue: department,
                  onSelect: (val) => setDepartment(val),
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !department && styles.selectTriggerPlaceholder,
                  !college && styles.selectTriggerDisabledText,
                ]}
                numberOfLines={1}
              >
                {department ||
                  (college ? "ዲፓርትመንት ይምረጡ..." : "በመጀመሪያ ኮሌጅ ይምረጡ")}
              </Text>
              <ChevronDown
                size={16}
                color={!college ? THEME.colors.border : THEME.colors.sacredAmber}
              />
            </TouchableOpacity>
          </View>

          {/* Entry Year & Program Duration */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>የገቡበት ዓመት *</Text>
              <TouchableOpacity
                style={styles.selectTrigger}
                onPress={() =>
                  openPicker({
                    title: "ወደ ግቢ የገቡበት ዓመት ይምረጡ",
                    options: entryYearOptions,
                    selectedValue: entryYear,
                    onSelect: (val) => setEntryYear(Number(val)),
                    searchable: true,
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.selectTriggerText}>{entryYear} ዓ.ም</Text>
                <ChevronDown size={14} color={THEME.colors.sacredAmber} />
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>የፕሮግራሙ ዓመታት *</Text>
              <TouchableOpacity
                style={styles.selectTrigger}
                onPress={() =>
                  openPicker({
                    title: "የፕሮግራሙ ዓመታት ይምረጡ",
                    options: PROGRAM_DURATIONS.map((d) => ({
                      label: `${d} ዓመት`,
                      value: d,
                    })),
                    selectedValue: programDuration,
                    onSelect: (val) => setProgramDuration(Number(val)),
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.selectTriggerText}>
                  {programDuration} ዓመት
                </Text>
                <ChevronDown size={14} color={THEME.colors.sacredAmber} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Academic Progress Preview Card */}
          {academicProgress && (
            <View
              style={[
                styles.academicPreviewCard,
                academicProgress.graduated
                  ? styles.academicGraduatedCard
                  : academicProgress.onBreak
                  ? styles.academicBreakCard
                  : styles.academicActiveCard,
              ]}
            >
              <Text style={styles.academicPreviewIcon}>
                {academicProgress.graduated
                  ? "🎓"
                  : academicProgress.onBreak
                  ? "☀️"
                  : "📚"}
              </Text>
              <View style={styles.academicPreviewContent}>
                <Text
                  style={[
                    styles.academicPreviewTitle,
                    academicProgress.graduated
                      ? styles.academicGraduatedTitle
                      : styles.academicActiveTitle,
                  ]}
                >
                  {academicProgress.label}
                </Text>
                <Text style={styles.academicPreviewSub}>
                  {academicProgress.graduated
                    ? "ፕሮግራሙ ተጠናቋል"
                    : academicProgress.onBreak
                    ? "ሴሚስተሮች መካከል — ቀጣዩ ዓመት ሲጀምር ይዘምናል"
                    : "ከመዝገቡ ቀን ተነስቶ ራሱ በራሱ ይሰላል"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── SECTION 4: የመገናኛ እና ቋንቋ መረጃ (CONNECTIVITY) ── */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Phone color={THEME.colors.sacredCrimson} size={16} />
            <Text style={styles.sectionTitle}>የመገናኛ እና ቋንቋ መረጃ</Text>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የስልክ ቁጥር *</Text>
            <TextInput
              style={styles.input}
              placeholder="09..."
              placeholderTextColor={THEME.colors.inkSubtle}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ኢሜል *</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1 },
                  emailStatus === "valid" && styles.inputSuccess,
                  emailStatus === "invalid" && styles.inputError,
                ]}
                placeholder="ለምሳሌ፡ atsedenis@gmail.com"
                placeholderTextColor={THEME.colors.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.inputTrailingIcon}>
                {emailStatus === "checking" && (
                  <ActivityIndicator
                    color={THEME.colors.sacredAmber}
                    size="small"
                  />
                )}
                {emailStatus === "valid" && (
                  <CheckCircle2 color={THEME.colors.success} size={18} />
                )}
                {emailStatus === "invalid" && (
                  <XCircle color={THEME.colors.error} size={18} />
                )}
              </View>
            </View>
            {emailMessage ? (
              <Text
                style={[
                  styles.fieldHelperText,
                  emailStatus === "valid"
                    ? { color: THEME.colors.success }
                    : emailStatus === "checking"
                    ? { color: THEME.colors.sacredAmber }
                    : { color: THEME.colors.error },
                ]}
              >
                {emailMessage}
              </Text>
            ) : null}
          </View>

          {/* Language Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>የአፍ መፍቻ ቋንቋ *</Text>
            <TouchableOpacity
              style={styles.selectTrigger}
              onPress={() =>
                openPicker({
                  title: "የአፍ መፍቻ ቋንቋ ይምረጡ",
                  options: languageOptions,
                  selectedValue: language,
                  onSelect: (val) => setLanguage(val),
                  searchable: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectTriggerText,
                  !language && styles.selectTriggerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {language || "ቋንቋ ይምረጡ..."}
              </Text>
              <ChevronDown size={16} color={THEME.colors.sacredAmber} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.submitBtnContent}>
              <Sparkles color="#FFFFFF" size={18} />
              <Text style={styles.submitBtnText}>ልጁን ወደ መዝገብ አስገባ</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── PHOTO SELECTION MODAL ── */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}
        >
          <View style={styles.photoOptionsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>የልጁን ፎቶ ይምረጡ</Text>
              <TouchableOpacity
                onPress={() => setShowPhotoOptions(false)}
                hitSlop={8}
              >
                <X color={THEME.colors.inkSubtle} size={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.photoOptionBtn}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.photoOptionIcon,
                  { backgroundColor: "#FEF3C7" },
                ]}
              >
                <Camera color="#B45309" size={20} />
              </View>
              <View style={styles.photoOptionText}>
                <Text style={styles.photoOptionLabel}>ካሜራ</Text>
                <Text style={styles.photoOptionSub}>በቀጥታ ፎቶ አንስተው ያያይዙ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoOptionBtn}
              onPress={handlePickPhoto}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.photoOptionIcon,
                  { backgroundColor: "#DBEAFE" },
                ]}
              >
                <Sparkles color="#1D4ED8" size={20} />
              </View>
              <View style={styles.photoOptionText}>
                <Text style={styles.photoOptionLabel}>ከፎቶ ማዕከል ምረጥ</Text>
                <Text style={styles.photoOptionSub}>
                  ከስልክዎ ጋለሪ ውስጥ ፎቶ ይምረጡ
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── GENERIC SEARCHABLE SELECT MODAL ── */}
      <Modal
        visible={Boolean(pickerModal)}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.pickerModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{pickerModal?.title}</Text>
              <TouchableOpacity
                onPress={() => setPickerModal(null)}
                hitSlop={8}
              >
                <X color={THEME.colors.inkSubtle} size={20} />
              </TouchableOpacity>
            </View>

            {pickerModal?.searchable && (
              <View style={styles.modalSearchRow}>
                <Search color={THEME.colors.inkSubtle} size={16} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="ፈልግ..."
                  placeholderTextColor={THEME.colors.inkSubtle}
                  value={pickerSearchQuery}
                  onChangeText={setPickerSearchQuery}
                  autoCorrect={false}
                />
                {pickerSearchQuery ? (
                  <TouchableOpacity
                    onPress={() => setPickerSearchQuery("")}
                    hitSlop={6}
                  >
                    <X color={THEME.colors.inkSubtle} size={14} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <FlatList
              data={filteredPickerOptions}
              keyExtractor={(item, idx) => `${item.value}_${idx}`}
              contentContainerStyle={styles.pickerListContent}
              renderItem={({ item }) => {
                const isSelected = item.value === pickerModal?.selectedValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItemRow,
                      isSelected && styles.pickerItemRowSelected,
                    ]}
                    onPress={() => {
                      pickerModal?.onSelect(item.value);
                      setPickerModal(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemLabel,
                        isSelected && styles.pickerItemLabelSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Check color={THEME.colors.sacredAmber} size={18} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>ምንም አማራጭ አልተገኘም</Text>
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  navBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navBackText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.sacredCrimson,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  portraitSection: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2.5,
    borderColor: THEME.colors.sacredAmber,
    backgroundColor: THEME.colors.surface,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.card,
  },
  avatarEmpty: {
    borderStyle: "dashed",
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  cameraPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  avatarEmptyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.sacredAmber,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removePhotoText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  portraitHint: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
    textAlign: "center",
  },
  tokenSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.amberBorder,
    padding: 16,
    gap: 8,
    ...THEME.shadows.card,
  },
  tokenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenSectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 0.5,
  },
  tokenRefreshBtn: {
    padding: 4,
  },
  tokenDisplay: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 18,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
    letterSpacing: 1.5,
  },
  tokenHint: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
    lineHeight: 16,
  },
  formSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    gap: 14,
    ...THEME.shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.sacredCrimson,
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  input: {
    backgroundColor: THEME.colors.sanctuaryBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.inkPrimary,
  },
  holyInput: {
    borderColor: THEME.colors.amberBorder,
    color: THEME.colors.inkPrimary,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  inputTrailingIcon: {
    position: "absolute",
    right: 12,
  },
  inputSuccess: {
    borderColor: "#A7F3D0",
  },
  inputError: {
    borderColor: "#FECACA",
  },
  fieldHelperText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    marginLeft: 4,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.sanctuaryBg,
    alignItems: "center",
  },
  toggleBtnActive: {
    borderColor: THEME.colors.sacredAmber,
    backgroundColor: "#FEF3C7",
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },
  toggleBtnTextActive: {
    color: "#92400E",
  },
  dateSelectorsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateSelectorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.sanctuaryBg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dateSelectorText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.sanctuaryBg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectTriggerDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  selectTriggerText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
    flex: 1,
    marginRight: 6,
  },
  selectTriggerPlaceholder: {
    color: THEME.colors.inkSubtle,
    fontWeight: "500",
  },
  selectTriggerDisabledText: {
    color: "#9CA3AF",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  academicPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  academicActiveCard: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  academicBreakCard: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  academicGraduatedCard: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  academicPreviewIcon: {
    fontSize: 22,
  },
  academicPreviewContent: {
    flex: 1,
  },
  academicPreviewTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  academicActiveTitle: {
    color: "#92400E",
  },
  academicGraduatedTitle: {
    color: "#065F46",
  },
  academicPreviewSub: {
    fontSize: 10,
    color: THEME.colors.inkSubtle,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: THEME.colors.sacredCrimson,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.button,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  photoOptionsCard: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.inkPrimary,
  },
  photoOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    gap: 12,
  },
  photoOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoOptionText: {
    flex: 1,
  },
  photoOptionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.inkPrimary,
  },
  photoOptionSub: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
    marginTop: 2,
  },
  pickerModalCard: {
    maxHeight: "80%",
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  modalSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.sanctuaryBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: THEME.colors.inkPrimary,
    padding: 0,
  },
  pickerListContent: {
    paddingBottom: 20,
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  pickerItemRowSelected: {
    backgroundColor: "#FEF3C7",
  },
  pickerItemLabel: {
    fontSize: 13.5,
    color: THEME.colors.inkPrimary,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  pickerItemLabelSelected: {
    color: "#92400E",
    fontWeight: "800",
  },
  emptyList: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyListText: {
    color: THEME.colors.inkSubtle,
    fontSize: 13,
  },
  successScreen: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  successCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: THEME.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 24,
    alignItems: "center",
    gap: 14,
    ...THEME.shadows.card,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
  },
  successSubtitle: {
    fontSize: 12.5,
    color: THEME.colors.inkSubtle,
    textAlign: "center",
    lineHeight: 18,
  },
  tokenBox: {
    width: "100%",
    backgroundColor: THEME.colors.sanctuaryBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.amberBorder,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  tokenBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
  },
  tokenBoxValue: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    letterSpacing: 1.5,
  },
  copyTokenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyTokenBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.sacredAmber,
  },
  finishBtn: {
    width: "100%",
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  finishBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
