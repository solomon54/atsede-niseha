import React from "react";
import { Tabs } from "expo-router";
import { Calendar, MessageSquare, User } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#F8FAFC",
        tabBarStyle: {
          backgroundColor: "#0F172A",
          borderTopColor: "#1E293B",
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarActiveTintColor: "#D97706",
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tabs.Screen
        name="appointments"
        options={{
          title: "ቀጠሮዎች",
          headerTitle: "የንስሐ ቀጠሮዎች",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Calendar color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "ውይይት",
          headerTitle: "መልእክቶች",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "መለያ",
          headerTitle: "መለያዬ",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
