import React from "react";
import { Stack } from "expo-router";
import { THEME } from "../../src/constants/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.navigationBg },
        headerTintColor: THEME.colors.sacredCrimson,
        contentStyle: { backgroundColor: THEME.colors.sanctuaryBg },
      }}
    >
      <Stack.Screen
        name="login"
        options={{ title: "መግቢያ", headerShown: false }}
      />
    </Stack>
  );
}
