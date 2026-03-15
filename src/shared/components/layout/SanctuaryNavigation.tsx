//src/components/layout/SanctuaryNavigation.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVIGATION_ITEMS } from "@/shared/constants/navigation";
import { UserRole } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

export function SanctuaryNavigation({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r border-slate-100 bg-white/80 backdrop-blur-xl z-50">
        <div className="p-8">
          <h2 className="text-sm font-black text-slate-900 tracking-[0.2em] font-ethiopic">
            ዐጸደ ንስሐ
          </h2>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300",
                  isActive
                    ? "bg-amber-50 text-amber-900"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                )}>
                <item.icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-amber-600" : "group-hover:text-slate-600"
                  )}
                />
                <span className="text-xs font-bold uppercase tracking-widest font-ethiopic">
                  {item.ethLabel}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-6 bg-amber-600 rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MOBILE BOTTOM TABS (Native Feel) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-2xl border-t border-slate-100 px-6 flex items-center justify-between z-50 pb-safe">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-1">
              <div
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive ? "text-amber-600" : "text-slate-400"
                )}>
                <item.icon className="w-6 h-6" />
              </div>
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-tighter font-ethiopic",
                  isActive ? "text-amber-900" : "text-slate-400"
                )}>
                {item.ethLabel}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-2 w-8 h-1 bg-amber-600 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
