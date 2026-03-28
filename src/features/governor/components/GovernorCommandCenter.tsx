//src/features/governor/components/GovernorCommandCenter.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { FiActivity, FiDatabase, FiUserPlus } from "react-icons/fi";

import { DirectoryRecord, FatherRecord, StudentRecord } from "@/shared/types";

import AuthorizeFathersForm from "./AuthorizeFathersForm";
import UnifiedDirectory from "./UnifiedDirectory";

type ViewMode = "REGISTRY" | "LEDGER" | "LOGS";

export default function GovernorCommandCenter({
  initialData,
}: {
  initialData: DirectoryRecord[];
}) {
  const [view, setView] = useState<ViewMode>("REGISTRY");

  // Type-safe splitting using the 'role' discriminator from your types
  const fathers = initialData.filter(
    (item): item is FatherRecord => item.role === "FATHER"
  );

  const students = initialData.filter(
    (item): item is StudentRecord => item.role === "STUDENT"
  );

  const tabs = [
    { id: "REGISTRY", label: "ምዝገባ", en: "Registry", icon: <FiUserPlus /> },
    { id: "LEDGER", label: "መዝገብ", en: "Ledger", icon: <FiDatabase /> },
    { id: "LOGS", label: "እንቅስቃሴ", en: "Logs", icon: <FiActivity /> },
  ] as const;

  return (
    <div className="w-full space-y-6 sm:space-y-10">
      {/* --- RESPONSIVE SEGMENTED CONTROL --- */}
      <nav className="sticky top-2 z-30 mx-auto w-full max-w-fit px-2">
        <div className="flex p-1 bg-slate-100/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
          {tabs.map((tab) => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`
                  relative flex items-center justify-center gap-2 sm:gap-3 
                  px-3 py-2.5 sm:px-6 sm:py-3.5 rounded-xl 
                  transition-all duration-500 ease-out
                  ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                      : "text-slate-400 hover:text-slate-600"
                  }
                `}>
                <span
                  className={`text-base sm:text-lg ${
                    isActive ? "text-amber-600" : ""
                  }`}>
                  {tab.icon}
                </span>

                {/* Hide secondary label on ultra-small screens */}
                <div className="text-left leading-none">
                  <p className="text-[11px] sm:text-xs font-black font-ethiopic tracking-tight">
                    {tab.label}
                  </p>
                  <p className="hidden xs:block text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.2em] opacity-40 mt-0.5">
                    {tab.en}
                  </p>
                </div>

                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* --- CONTENT ARCHITECTURE --- */}
      <div className="relative w-full px-1 sm:px-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="w-full">
            {view === "REGISTRY" && (
              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                <AuthorizeFathersForm />
              </div>
            )}

            {view === "LEDGER" && (
              <div className="w-full overflow-hidden rounded-3xl border border-amber-50 bg-white">
                <UnifiedDirectory
                  initialFathers={fathers}
                  initialStudents={students}
                />
              </div>
            )}

            {view === "LOGS" && (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                  <FiActivity className="w-6 h-6" />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                  System Audit Logs
                </h3>
                <p className="text-[9px] text-slate-300 font-bold mt-2 font-ethiopic">
                  የስርዓት እንቅስቃሴ ምዝግብ ማስታወሻ በቅርቡ ይጠናቀቃል
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
