// src/shared/constants/navigation.ts
import {
  Bell,
  BookOpen,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  {
    label: "Home",
    ethLabel: "መነሻ",
    href: "/dashboard",
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
    href: "/dashboard/father",
    icon: Users,
    roles: ["FATHER"],
  },
  {
    label: "Father",
    ethLabel: "አባቴ",
    href: "/messages",
    icon: ShieldCheck,
    roles: ["STUDENT"],
  },
  {
    label: "Ledger",
    ethLabel: "ማኅደር",
    href: "/dashboard/notes",
    icon: BookOpen,
    roles: ["STUDENT"],
  },
  {
    label: "Updates",
    ethLabel: "ማሳሰቢያ",
    href: "/dashboard/updates",
    icon: Bell,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  {
    label: "Settings",
    ethLabel: "ማስተካከያ",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
];
