import React from "react";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#F8FAFC",
        contentStyle: { backgroundColor: "#0B1120" },
      }}
    >
      <Stack.Screen name="login" options={{ title: "መግቢያ", headerShown: false }} />
    </Stack>
  );
}

