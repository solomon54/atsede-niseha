// mobile/app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Calendar, MessageSquare, Shield, User, Users } from "lucide-react-native";
import { useAuth } from "../../src/lib/auth-context";
import { THEME } from "../../src/constants/theme";

export default function TabsLayout() {
  const { role } = useAuth();
  const isFather = role === "FATHER";
  const isGovernor = role === "GOVERNOR";

  const initialTabName = isGovernor
    ? "governor"
    : isFather
    ? "children"
    : "appointments";

  return (
    <Tabs
      initialRouteName={initialTabName}
      backBehavior="history"
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.colors.navigationBg,
          borderBottomWidth: 1,
          borderBottomColor: THEME.colors.sacredCrimsonBorder,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleAlign: "center",
        headerTitle: () => (
          <View style={styles.headerTitleBox}>
            <Text style={styles.brandTitleText}>ዐጸደ ንስሐ</Text>
            <Text style={styles.brandSubText}>SANCTUARY</Text>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: THEME.colors.navigationBg,
          borderTopWidth: 1,
          borderTopColor: THEME.colors.sacredCrimsonBorder,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 4,
          shadowColor: THEME.colors.sacredCrimson,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: THEME.colors.sacredCrimson,
        tabBarInactiveTintColor: THEME.colors.inkSubtle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      {/* Father Flock Tab - Primary for Fathers */}
      <Tabs.Screen
        name="children"
        options={{
          title: "መንጋዬ",
          href: isFather ? "/(tabs)/children" : null,
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <Users color={color} size={20} />
            </View>
          ),
        }}
      />

      {/* Appointments Tab */}
      <Tabs.Screen
        name="appointments"
        options={{
          title: "ቀጠሮ",
          href: isGovernor ? null : "/(tabs)/appointments",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <Calendar color={color} size={20} />
            </View>
          ),
        }}
      />

      {/* Messaging Tab */}
      <Tabs.Screen
        name="chat"
        options={{
          title: "መልዕክት",
          href: isGovernor ? null : "/(tabs)/chat",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <MessageSquare color={color} size={20} />
            </View>
          ),
        }}
      />

      {/* Governor Command Center Tab */}
      <Tabs.Screen
        name="governor"
        options={{
          title: "መቆጣጠሪያ",
          href: isGovernor ? "/(tabs)/governor" : null,
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <Shield color={color} size={20} />
            </View>
          ),
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "መገለጫ",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <User color={color} size={20} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitleBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitleText: {
    fontSize: 17,
    fontWeight: "900",
    color: THEME.colors.sacredCrimson,
    letterSpacing: -0.3,
  },
  brandSubText: {
    fontSize: 8,
    fontWeight: "800",
    color: THEME.colors.sacredAmber,
    letterSpacing: 2,
  },
  iconWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: THEME.radii.md,
  },
  iconWrapperActive: {
    backgroundColor: THEME.colors.sacredCrimsonLight,
  },
});
