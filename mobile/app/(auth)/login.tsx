import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Award,
  Church,
  GraduationCap,
  MapPin,
  User,
  Lock,
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react-native";
import { useAuth } from "../../src/lib/auth-context";
import { apiRequest } from "../../src/lib/api";
import { THEME } from "../../src/constants/theme";

type GatewayStep = "ID_ENTRY" | "PROFILE_PREVIEW" | "SECURITY_SETUP";

interface ProfileContext {
  eotcUid: string;
  role: "FATHER" | "STUDENT" | "GOVERNOR";
  displayName?: string;
  fullName?: string;
  title?: string;
  diocese?: string;
  parish?: string;
  university?: string;
  photoUrl?: string;
  email?: string;
  accountClaimed?: boolean;
}

export default function LoginScreen() {
  const [step, setStep] = useState<GatewayStep>("ID_ENTRY");
  const [eotcUid, setEotcUid] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [context, setContext] = useState<ProfileContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, claim } = useAuth();
  const router = useRouter();

  // 1. Submit UID to Gateway
  const handleCheckUid = async () => {
    const formatted = eotcUid.trim().toUpperCase();
    if (!formatted || formatted.length < 4) {
      setError("ትክክለኛ የመለያ ቁጥር ያስገቡ");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<any>("/api/auth/gateway", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({ eotcUid: formatted }),
      });

      if (!res.success) {
        setError(res.error || "ያስገቡት መለያ አልተገኘም");
        return;
      }

      const role = (res.role || "STUDENT").toUpperCase() as
        | "FATHER"
        | "STUDENT"
        | "GOVERNOR";

      const profile: ProfileContext = {
        eotcUid: formatted,
        role,
        displayName:
          res.displayName ||
          res.data?.displayName ||
          res.fullName ||
          res.data?.fullName,
        fullName: res.fullName || res.data?.fullName,
        title: res.title || res.data?.title,
        diocese: res.diocese || res.data?.diocese,
        parish: res.parish || res.data?.parish,
        university: res.university || res.data?.university,
        photoUrl: res.photoUrl || res.data?.photoUrl,
        email: res.email || res.data?.email || "",
        accountClaimed: res.action === "LOGIN",
      };

      if (profile.email) setEmail(profile.email);
      setContext(profile);

      // Governors skip directly to security setup, Fathers & Students see preview
      if (role === "GOVERNOR") {
        setStep("SECURITY_SETUP");
      } else {
        setStep("PROFILE_PREVIEW");
      }
    } catch (err: any) {
      setError(err.message || "የመረብ ግንኙነት ችግር አጋጥሟል");
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Login or Claim
  const handleSecuritySubmit = async () => {
    if (!context) return;
    setError(null);

    if (context.accountClaimed) {
      if (!password) {
        setError("እባክዎ የይለፍ ቃል ያስገቡ");
        return;
      }
      setLoading(true);
      try {
        const { role } = await login(context.eotcUid, password);
        router.replace(
          role === "GOVERNOR" ? "/(tabs)/profile" : "/(tabs)/appointments"
        );
      } catch (err: any) {
        setError(err.message || "የተሳሳተ የይለፍ ቃል ነው");
      } finally {
        setLoading(false);
      }
    } else {
      // Claim flow
      if (!password || password.length < 8) {
        setError("የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("ትክክለኛ የኢሜይል አድራሻ ያስገቡ");
        return;
      }
      if (password !== confirmPassword) {
        setError("የይለፍ ቃሎቹ አይመሳሰሉም");
        return;
      }
      setLoading(true);
      try {
        const { role } = await claim(
          context.eotcUid,
          password,
          email,
          context.role
        );
        router.replace(
          role === "GOVERNOR" ? "/(tabs)/profile" : "/(tabs)/appointments"
        );
      } catch (err: any) {
        setError(err.message || "መለያውን ማረጋገጥ አልተቻለም");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================ */}
        {/* STEP 1: ID_ENTRY (Ecclesiastical Gateway)                        */}
        {/* ================================================================ */}
        {step === "ID_ENTRY" && (
          <View style={styles.cardWrapper}>
            {/* Sacred Church Header */}
            <View style={styles.header}>
              <View style={styles.logoHaloContainer}>
                <View style={styles.logoGlow} />
                <View style={styles.logoBorder}>
                  <Image
                    source={require("../../assets/qdst-bite-krstiyan.jpg")}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                </View>
              </View>

              <Text style={styles.brandTitle}>ዐጸደ ንስሐ</Text>
              <Text style={styles.brandSubtitle}>ECCLESIASTICAL GATEWAY</Text>
            </View>

            {/* Sanctuary Surface Card */}
            <View style={styles.sanctuaryCard}>
              <Text style={styles.cardHeading}>የመለያ ቁጥርዎን ያስገቡ</Text>
              <View style={styles.accentDivider} />

              {error && (
                <View style={styles.errorBanner}>
                  <ShieldAlert color={THEME.colors.error} size={18} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.uidInput}
                  placeholder="EOTC-XXXXXX"
                  placeholderTextColor={THEME.colors.inkSubtle}
                  value={eotcUid}
                  onChangeText={(txt) => {
                    setEotcUid(txt.toUpperCase());
                    setError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  selectionColor={THEME.colors.sacredAmber}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryDarkButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleCheckUid}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={THEME.colors.sacredAmber} />
                ) : (
                  <View style={styles.buttonInnerRow}>
                    <Search color={THEME.colors.sacredAmber} size={18} />
                    <Text style={styles.buttonInnerText}>መለያውን ፈልግ</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer Notice */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerNotice}>
                ይህ መለያ በአጥቢያዎ በሚገኝ{"\n"}
                <Text style={styles.footerBold}>መምህረ ንስሐ ብቻ የሚሰጥ ነው።</Text>
              </Text>
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* STEP 2: PROFILE_PREVIEW (ማንነትዎን ያረጋግጡ)                     */}
        {/* ================================================================ */}
        {step === "PROFILE_PREVIEW" && context && (
          <View style={styles.cardWrapper}>
            <View style={styles.header}>
              <Text style={styles.brandSubtitle}>IDENTITY VERIFICATION</Text>
              <Text style={styles.brandTitle}>ማንነትዎን ያረጋግጡ</Text>
            </View>

            <View style={styles.sanctuaryCard}>
              {/* Back action */}
              <TouchableOpacity
                style={styles.backRow}
                onPress={() => {
                  setStep("ID_ENTRY");
                  setError(null);
                }}
              >
                <ArrowLeft color={THEME.colors.inkMuted} size={16} />
                <Text style={styles.backText}>ተመለስ</Text>
              </TouchableOpacity>

              {/* Avatar Frame with Sacred Halo */}
              <View style={styles.previewAvatarContainer}>
                <View style={styles.avatarHaloRing} />
                <View style={styles.avatarInnerCircle}>
                  {context.photoUrl ? (
                    <Image
                      source={{ uri: context.photoUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <User color={THEME.colors.inkSubtle} size={48} />
                  )}
                </View>
                <View style={styles.verifiedBadge}>
                  <ShieldCheck color={THEME.colors.success} size={20} />
                </View>
              </View>

              {/* Role pill & Name */}
              <View style={styles.rolePill}>
                <Award color={THEME.colors.sacredAmber} size={14} />
                <Text style={styles.rolePillText}>
                  {context.role === "FATHER" ? "መምህረ ንስሐ" : "የንስሐ ልጅ"}
                </Text>
              </View>

              {context.role === "FATHER" && context.title ? (
                <Text style={styles.spiritualTitle}>{context.title}</Text>
              ) : null}

              <Text style={styles.personDisplayName}>
                {context.displayName || "የተከበሩ ተጠቃሚ"}
              </Text>

              {/* Metadata rows (Diocese, Parish / University) */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <MapPin color={THEME.colors.sacredAmber} size={16} />
                  <Text style={styles.metaText}>
                    {context.diocese || "ሀገረ ስብከት አልተጠቀሰም"}
                  </Text>
                </View>

                {context.role === "FATHER" && context.parish ? (
                  <View style={styles.metaRow}>
                    <Church color={THEME.colors.sacredAmber} size={16} />
                    <Text style={styles.metaText}>{context.parish}</Text>
                  </View>
                ) : null}

                {context.role === "STUDENT" && context.university ? (
                  <View style={styles.metaRow}>
                    <GraduationCap color={THEME.colors.sacredAmber} size={16} />
                    <Text style={styles.metaText}>{context.university}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.confirmPrompt}>
                ይህ የእርስዎ መለያ መሆኑን ካረጋገጡ{"\n"}መግቢያዎን ያዘጋጁ
              </Text>

              <TouchableOpacity
                style={styles.primaryDarkButton}
                onPress={() => setStep("SECURITY_SETUP")}
                activeOpacity={0.85}
              >
                <View style={styles.buttonInnerRow}>
                  <CheckCircle2 color={THEME.colors.sacredAmber} size={18} />
                  <Text style={styles.buttonInnerText}>አዎ እኔ ነኝ - ቀጥል</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* STEP 3: SECURITY_SETUP (ደጅ ክፈት / መግቢያ አጽና)                    */}
        {/* ================================================================ */}
        {step === "SECURITY_SETUP" && context && (
          <View style={styles.cardWrapper}>
            <View style={styles.header}>
              <View style={styles.lockHaloContainer}>
                <View style={styles.lockHaloRing} />
                <View style={styles.lockIconCircle}>
                  <Lock color={THEME.colors.sacredAmber} size={28} />
                </View>
              </View>

              <Text style={styles.brandTitle}>
                {context.accountClaimed ? "ደጅ ክፈት" : "መግቢያ ማዘጋጃ"}
              </Text>
              <Text style={styles.brandSubtitle}>
                {context.accountClaimed
                  ? "AUTHENTICATE SANCTUARY"
                  : "ESTABLISH COVENANT"}
              </Text>
            </View>

            <View style={styles.sanctuaryCard}>
              <TouchableOpacity
                style={styles.backRow}
                onPress={() => {
                  setStep("PROFILE_PREVIEW");
                  setError(null);
                }}
              >
                <ArrowLeft color={THEME.colors.inkMuted} size={16} />
                <Text style={styles.backText}>ተመለስ</Text>
              </TouchableOpacity>

              {error && (
                <View style={styles.errorBanner}>
                  <ShieldAlert color={THEME.colors.error} size={18} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Claim flow: Email input */}
              {!context.accountClaimed && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>ኢሜይል</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="example@mail.com"
                    placeholderTextColor={THEME.colors.inkSubtle}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Password field */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>
                  {context.accountClaimed
                    ? "የይለፍ ቃል"
                    : "አዲስ የይለፍ ቃል (ቢያንስ 8 ፊደላት)"}
                </Text>
                <View style={styles.passwordFieldWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="የይለፍ ቃል ያስገቡ"
                    placeholderTextColor={THEME.colors.inkSubtle}
                    value={password}
                    onChangeText={(txt) => {
                      setPassword(txt);
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff color={THEME.colors.inkMuted} size={20} />
                    ) : (
                      <Eye color={THEME.colors.inkMuted} size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm password field for new claims */}
              {!context.accountClaimed && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>የይለፍ ቃሉን ያረጋግጡ</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="የይለፍ ቃሉን ደግመው ያስገቡ"
                    placeholderTextColor={THEME.colors.inkSubtle}
                    value={confirmPassword}
                    onChangeText={(txt) => {
                      setConfirmPassword(txt);
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryDarkButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSecuritySubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={THEME.colors.sacredAmber} />
                ) : (
                  <View style={styles.buttonInnerRow}>
                    <Lock color={THEME.colors.sacredAmber} size={18} />
                    <Text style={styles.buttonInnerText}>
                      {context.accountClaimed ? "ደጅ ክፈት" : "መግቢያውን አጽና"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 36,
    justifyContent: "center",
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  /* Header with circular church logo */
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoHaloContainer: {
    position: "relative",
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.amberLight,
  },
  logoBorder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2.5,
    borderColor: THEME.colors.sacredAmber,
    overflow: "hidden",
    backgroundColor: THEME.colors.surface,
    padding: 2,
    ...THEME.shadows.halo,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
  },

  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  /* Sanctuary Surface Card */
  sanctuaryCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radii.xxl,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  cardHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
    textAlign: "center",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  accentDivider: {
    width: 44,
    height: 2.5,
    backgroundColor: THEME.colors.sacredAmber,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },

  /* UID Input Field */
  inputContainer: {
    marginBottom: 20,
  },
  uidInput: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderRadius: THEME.radii.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.amberBorder,
    color: THEME.colors.inkPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },

  /* Action Buttons */
  primaryDarkButton: {
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.button,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonInnerText: {
    color: THEME.colors.buttonDarkText,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  /* Footer */
  footerContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  footerNotice: {
    fontSize: 11,
    color: THEME.colors.inkSubtle,
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  footerBold: {
    color: THEME.colors.inkSecondary,
    fontWeight: "700",
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: THEME.colors.errorBg,
    borderColor: THEME.colors.errorBorder,
    borderWidth: 1,
    borderRadius: THEME.radii.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: THEME.colors.error,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },

  /* Back Row */
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkMuted,
  },

  /* Profile Preview */
  previewAvatarContainer: {
    alignSelf: "center",
    position: "relative",
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarHaloRing: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: THEME.colors.amberBorder,
    borderStyle: "dashed",
  },
  avatarInnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: THEME.colors.surface,
    ...THEME.shadows.card,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },

  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: THEME.colors.buttonDark,
    borderRadius: THEME.radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 1,
  },
  spiritualTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.sacredAmber,
    textAlign: "center",
    marginBottom: 2,
  },
  personDisplayName: {
    fontSize: 22,
    fontWeight: "900",
    color: THEME.colors.inkPrimary,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  metaBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.colors.borderLight,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.inkSecondary,
  },
  confirmPrompt: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.inkSubtle,
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 18,
    marginBottom: 18,
  },

  /* Lock Header in Security Setup */
  lockHaloContainer: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockHaloRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.amberLight,
  },
  lockIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.amberBorder,
    alignItems: "center",
    justifyContent: "center",
    ...THEME.shadows.card,
  },

  /* Form inputs in Security Setup */
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.inkSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  formInput: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.inkPrimary,
  },
  passwordFieldWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 15,
    color: THEME.colors.inkPrimary,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    padding: 6,
  },
});
