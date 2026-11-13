import React, { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth-context";
import { apiRequest } from "../../src/lib/api";

type GatewayState = "CHECK_UID" | "ENTER_PASSWORD" | "CLAIM_ACCOUNT";

export default function LoginScreen() {
  const [eotcUid, setEotcUid] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [state, setState] = useState<GatewayState>("CHECK_UID");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, claim } = useAuth();
  const router = useRouter();

  const handleCheckUid = async () => {
    if (!eotcUid.trim() || eotcUid.trim().length < 4) {
      setError("እባክዎ ትክክለኛ መለያ ቁጥር ያስገቡ");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formatted = eotcUid.trim().toUpperCase();
      const res = await apiRequest<any>("/api/auth/gateway", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({ eotcUid: formatted }),
      });

      if (!res.success) {
        setError(res.error || "መለያ አልተገኘም");
        return;
      }

      setDisplayName(res.displayName);
      setRole(res.role);

      if (res.action === "LOGIN") {
        setState("ENTER_PASSWORD");
      } else {
        if (res.email) setEmail(res.email);
        setState("CLAIM_ACCOUNT");
      }
    } catch (err: any) {
      setError(err.message || "የኔትወርክ ወይም የስርዓት ስህተት");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError("እባክዎ የይለፍ ቃል ያስገቡ");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(eotcUid, password);
      router.replace("/(tabs)/appointments");
    } catch (err: any) {
      setError(err.message || "የይለፍ ቃል ስህተት ነው");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!password || password.length < 8) {
      setError("የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት");
      return;
    }
    if (!email) {
      setError("እባክዎ ኢሜይል ያስገቡ");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await claim(eotcUid, password, email);
      router.replace("/(tabs)/appointments");
    } catch (err: any) {
      setError(err.message || "መለያውን ማንሳት አልተቻለም");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.cross}>✞</Text>
          <Text style={styles.brandTitle}>ዐጸደ ንስሐ</Text>
          <Text style={styles.brandSubtitle}>
            {state === "CHECK_UID"
              ? "የመለያ ቁጥርዎን ያስገቡ"
              : state === "ENTER_PASSWORD"
              ? `ሰላም ${displayName || ""}፣ እንኳን ደህና መጡ`
              : `ሰላም ${displayName || ""}፣ መለያዎን ያንሱ`}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {state === "CHECK_UID" && (
          <View style={styles.form}>
            <Text style={styles.label}>የኦርቶዶክስ ተዋሕዶ መለያ (EOTC UID)</Text>
            <TextInput
              style={styles.input}
              placeholder="ምሳሌ፡ EOTC-1234"
              placeholderTextColor="#64748B"
              value={eotcUid}
              onChangeText={(txt: string) => {
                setEotcUid(txt);
                setError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleCheckUid}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>ቀጥል</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {state === "ENTER_PASSWORD" && (
          <View style={styles.form}>
            <Text style={styles.label}>የይለፍ ቃል</Text>
            <TextInput
              style={styles.input}
              placeholder="የይለፍ ቃል ያስገቡ"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={(txt: string) => {
                setPassword(txt);
                setError(null);
              }}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>ግባ</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setState("CHECK_UID");
                setPassword("");
                setError(null);
              }}
            >
              <Text style={styles.backButtonText}>ተመለስ</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === "CLAIM_ACCOUNT" && (
          <View style={styles.form}>
            <Text style={styles.label}>ኢሜይል</Text>
            <TextInput
              style={styles.input}
              placeholder="example@mail.com"
              placeholderTextColor="#64748B"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>አዲስ የይለፍ ቃል (ቢያንስ 8 ፊደላት)</Text>
            <TextInput
              style={styles.input}
              placeholder="አዲስ የይለፍ ቃል"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleClaim}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>መለያዬን አንሳ</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setState("CHECK_UID");
                setPassword("");
                setError(null);
              }}
            >
              <Text style={styles.backButtonText}>ተመለስ</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  cross: {
    fontSize: 40,
    color: "#D97706",
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CBD5E1",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#D97706",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  backButtonText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: "#450A0A",
    borderColor: "#991B1B",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    textAlign: "center",
  },
});

