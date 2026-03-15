//src/shared/constants/navigation.ts
import {
  Bell,
  BookOpen,
  Home,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { UserRole } from "@/shared/types/auth.types";

export interface NavItem {
  label: string;
  ethLabel: string;
  href: string;
  icon: any;
  roles: UserRole[];
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    label: "Home",
    ethLabel: "መነሻ",
    href: "/dashboard",
    icon: Home,
    roles: ["FATHER", "STUDENT", "GOVERNOR"],
  },
  {
    label: "Flock",
    ethLabel: "መንጋዬ",
    href: "/dashboard/father/flock",
    icon: Users,
    roles: ["FATHER"],
  },
  {
    label: "Father",
    ethLabel: "አባቴ",
    href: "/dashboard/student/my-father",
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
