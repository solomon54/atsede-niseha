// src/shared/constants/navigation.ts
import {
  Bell,
  BookOpen,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  {
    label: "Home",
    ethLabel: "መነሻ",
    href: "/messages",
    icon: Home,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  {
    label: "Governor",
    ethLabel: "ማስተዳደርያ",
    href: "/governor",
    icon: LayoutDashboard,
    roles: ["GOVERNOR"],
  },
  {
    label: "Flock",
    ethLabel: "መንጋዬ",
    href: "/father",
    icon: Users,
    roles: ["FATHER"],
  },
  {
    label: "Father",
    ethLabel: "አባቴ",
    href: "/message",
    icon: ShieldCheck,
    roles: ["STUDENT"],
  },
  {
    label: "Ledger",
    ethLabel: "ማኅደር",
    href: "/notes",
    icon: BookOpen,
    roles: ["STUDENT"],
  },
  {
    label: "Updates",
    ethLabel: "መገለጫ",
    href: "/profile",
    icon: User,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  {
    label: "Settings",
    ethLabel: "ማስተካከያ",
    href: "/settings",
    icon: Settings,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
];
