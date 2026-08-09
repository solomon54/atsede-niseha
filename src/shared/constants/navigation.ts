// src/shared/constants/navigation.ts
import {
  Bell,
  BookOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
  User,
  Users,
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  // ── Messaging (all roles) ──
  {
    label: "Messages",
    ethLabel: "ምስጢር",
    href: "/messages",
    icon: MessageSquare,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  // ── Appointments (Father + Student only) ──
  {
    label: "Appointments",
    ethLabel: "ቀጠሮ",
    href: "/appointments",
    icon: Bell,
    roles: ["FATHER", "STUDENT"],
  },
  // ── Governor dashboard ──
  {
    label: "Governor",
    ethLabel: "ቁጥጥር",
    href: "/governor",
    icon: LayoutDashboard,
    roles: ["GOVERNOR"],
  },
  // ── Father flock management ──
  {
    label: "Flock",
    ethLabel: "መንጋዬ",
    href: "/father",
    icon: Users,
    roles: ["FATHER"],
  },
  // ── Student notes/ledger ──
  {
    label: "Notes",
    ethLabel: "ማኅደር",
    href: "/notes",
    icon: BookOpen,
    roles: ["STUDENT"],
  },
  // ── Profile (all roles) ──
  {
    label: "Profile",
    ethLabel: "መገለጫ",
    href: "/profile",
    icon: User,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  // ── Settings (all roles) ──
  {
    label: "Settings",
    ethLabel: "ቅንብሮች",
    href: "/settings",
    icon: Settings,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
];
