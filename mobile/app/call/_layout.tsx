import React from "react";
import { Stack } from "expo-router";

export default function CallLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0B1120" },
      }}
    />
  );
}

