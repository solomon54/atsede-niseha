import React from "react";
import { Stack } from "expo-router";

export default function ChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#F8FAFC",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#0B1120" },
      }}
    >
      <Stack.Screen name="[channelId]" options={{ title: "ውይይት" }} />
    </Stack>
  );
}

