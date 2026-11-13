import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/lib/auth-context";
import { THEME } from "../src/constants/theme";

export default function IndexScreen() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/(tabs)/appointments");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoHaloContainer}>
        <View style={styles.logoGlow} />
        <View style={styles.logoBorder}>
          <Image
            source={require("../assets/qdst-bite-krstiyan.jpg")}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </View>

      <Text style={styles.title}>ዐጸደ ንስሐ</Text>
      <Text style={styles.subtitle}>ECCLESIASTICAL GATEWAY</Text>
      <ActivityIndicator
        size="small"
        color={THEME.colors.sacredAmber}
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.sanctuaryBg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoHaloContainer: {
    position: "relative",
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoGlow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: THEME.colors.amberLight,
  },
  logoBorder: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    borderRadius: 44,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    marginBottom: 4,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  spinner: {
    marginTop: 32,
  },
});
