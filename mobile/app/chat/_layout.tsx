import React from "react";
import { Stack } from "expo-router";
import { THEME } from "../../src/constants/theme";

export default function ChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.colors.navigationBg,
        },
        headerTintColor: THEME.colors.sacredCrimson,
        headerTitleStyle: {
          fontWeight: "800",
          color: THEME.colors.sacredCrimson,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: THEME.colors.sanctuaryBg,
        },
      }}
    >
      <Stack.Screen name="[channelId]" options={{ title: "ምስጢር ውይይት" }} />
    </Stack>
  );
}
