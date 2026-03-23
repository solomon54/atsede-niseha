//src/shared/components/layout/SanctuaryNavigation.tsx

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useScrollDirection } from "@/shared/config/useScrollDirection";
import { NAVIGATION_ITEMS } from "@/shared/constants/navigation";
import { UserRole } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

export function SanctuaryNavigation({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const scrollDirection = useScrollDirection();

  // Filter items based on the three roles: GOVERNOR, FATHER, STUDENT
  const items = NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* DESKTOP SIDEBAR: Clean and Fixed */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-20 lg:w-64 flex-col border-r border-[#9b2d30]/10 bg-[#fdfaf1] z-50">
        <div className="p-6 lg:p-8 flex justify-center lg:justify-start">
          <h2 className="text-xs lg:text-sm font-black text-[#9b2d30] tracking-[0.2em] font-ethiopic">
            {/* Show full name only on large screens */}
            <span className="hidden lg:inline">ዐጸደ ንስሐ</span>
            <span className="lg:hidden text-lg">ዐ</span>
          </h2>
        </div>

        <nav className="flex-1 px-2 lg:px-4 space-y-4">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex flex-col lg:flex-row items-center gap-1 lg:gap-4 px-2 py-3 lg:px-4 rounded-xl transition-all duration-300",
                  isActive
                    ? "bg-[#9b2d30]/5 text-[#9b2d30]"
                    : "text-slate-400 hover:bg-slate-50"
                )}>
                <item.icon
                  className={cn("w-5 h-5", isActive ? "text-[#9b2d30]" : "")}
                />
                <span className="text-[9px] lg:text-xs font-bold uppercase tracking-tighter lg:tracking-widest font-ethiopic">
                  {item.ethLabel}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="hidden lg:block absolute left-0 w-1 h-6 bg-[#9b2d30] rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MOBILE BOTTOM TABS: Optimized for <320px */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#fdfaf1]/95 backdrop-blur-xl border-t border-[#9b2d30]/20 px-2 flex items-center justify-around z-50 pb-safe transition-transform duration-500",
          scrollDirection === "down" ? "translate-y-full" : "translate-y-0"
        )}>
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center min-w-[50px] gap-0.5">
              <div
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isActive ? "text-[#9b2d30] bg-[#9b2d30]/5" : "text-slate-500"
                )}>
                <item.icon className="w-5 h-5" />{" "}
                {/* Slightly smaller for <320px */}
              </div>
              <span
                className={cn(
                  "text-[7.5px] font-black uppercase tracking-tighter font-ethiopic leading-none",
                  isActive ? "text-[#9b2d30]" : "text-slate-500"
                )}>
                {item.ethLabel}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1.5 w-6 h-0.5 bg-[#9b2d30] rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
