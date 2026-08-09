// src/shared/components/layout/SanctuaryNavigation.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useScrollDirection } from "@/shared/config/useScrollDirection";
import { NAVIGATION_ITEMS } from "@/shared/constants/navigation";
import { UserRole } from "@/shared/types/auth.types";
import { cn } from "@/shared/utils/utils";

type SessionState = "loading" | "authenticated" | "unauthenticated";

export function SanctuaryNavigation() {
  const pathname = usePathname();
  const scrollDirection = useScrollDirection();

  const [role, setRole] = useState<UserRole | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("loading");

  // Verify the session server-side on mount and whenever the path changes
  // (catches back-navigation after logout)
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      // Gateway page — never show nav here
      if (pathname === "/") {
        setSessionState("unauthenticated");
        setRole(null);
        return;
      }

      try {
        const res = await fetch("/api/auth/refresh", {
          credentials: "include",
          // Don't cache — we need live verification
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) {
          if (!cancelled) {
            setSessionState("unauthenticated");
            setRole(null);
            // Clear stale localStorage entry
            localStorage.removeItem("sacred_ledger_session");
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          const detectedRole = data?.role as UserRole | undefined;
          setRole(detectedRole ?? null);
          setSessionState(detectedRole ? "authenticated" : "unauthenticated");
          // Keep localStorage in sync so messaging client works
          if (detectedRole) {
            localStorage.setItem(
              "sacred_ledger_session",
              JSON.stringify(data)
            );
          }
        }
      } catch {
        if (!cancelled) {
          setSessionState("unauthenticated");
          setRole(null);
        }
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [pathname]);

  // Don't render anything on the gateway page or while loading
  if (pathname === "/" || sessionState !== "authenticated" || !role) return null;

  const items = NAVIGATION_ITEMS.filter((item) =>
    (item.roles as string[]).includes(role)
  );

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-20 lg:w-64
        flex-col border-r border-[#9b2d30]/10 bg-[#fdfaf1] z-50">

        <div className="p-5 lg:p-8 flex justify-center lg:justify-start shrink-0">
          <h2 className="text-xs lg:text-sm font-black text-[#9b2d30] tracking-[0.2em]
            font-ethiopic">
            <span className="hidden lg:inline">ዐጸደ ንስሐ</span>
            <span className="lg:hidden text-lg">ዐ</span>
          </h2>
        </div>

        <nav className="flex-1 px-2 lg:px-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "group relative flex flex-col lg:flex-row items-center gap-1 lg:gap-3",
                  "px-2 py-2.5 lg:px-4 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-[#9b2d30]/8 text-[#9b2d30]"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                )}>
                <item.icon
                  className={cn(
                    "w-[18px] h-[18px] lg:w-5 lg:h-5 shrink-0",
                    isActive ? "text-[#9b2d30]" : ""
                  )}
                />
                <span className="text-[8px] lg:text-[11px] font-bold uppercase
                  tracking-tight lg:tracking-widest font-ethiopic">
                  {item.ethLabel}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="hidden lg:block absolute left-0 w-[3px] h-5
                      bg-[#9b2d30] rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── MOBILE BOTTOM TABS ──────────────────────────── */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-50",
          "bg-[#fdfaf1]/96 backdrop-blur-xl border-t border-[#9b2d30]/15",
          "px-1 flex items-stretch justify-around",
          "transition-transform duration-300 ease-in-out",
          // Hide on scroll down
          scrollDirection === "down" ? "translate-y-full" : "translate-y-0"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.map((item) => {
          const isActive = pathname === item.href ||
            pathname.startsWith(item.href + "/");
          return (
            <Link
              key={`mob-${item.href}-${item.label}`}
              href={item.href}
              className="relative flex flex-col items-center justify-center
                min-w-0 flex-1 py-2 gap-0.5 group">
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-colors",
                  isActive
                    ? "text-[#9b2d30] bg-[#9b2d30]/8"
                    : "text-slate-400 group-active:bg-slate-100"
                )}>
                <item.icon className="w-[19px] h-[19px]" />
              </div>
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-tight font-ethiopic leading-none",
                  isActive ? "text-[#9b2d30]" : "text-slate-400"
                )}>
                {item.ethLabel}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeMobileTab"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px]
                    bg-[#9b2d30] rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
