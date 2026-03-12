//src/features/governor/components/GovernorCommandCenter.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { FiActivity, FiDatabase, FiUserPlus } from "react-icons/fi";

import { DirectoryRecord } from "@/shared/types";

import AuthorizeFathersForm from "./AuthorizeFathersForm";
import UnifiedDirectory from "./UnifiedDirectory";

type ViewMode = "REGISTRY" | "LEDGER" | "LOGS";

export default function GovernorCommandCenter({
  initialData,
}: {
  initialData: DirectoryRecord[];
}) {
  const [view, setView] = useState<ViewMode>("REGISTRY");

  const tabs = [
    { id: "REGISTRY", label: "ምዝገባ", en: "Registry", icon: <FiUserPlus /> },
    { id: "LEDGER", label: "መዝገብ", en: "Ledger", icon: <FiDatabase /> },
    { id: "LOGS", label: "እንቅስቃሴ", en: "Logs", icon: <FiActivity /> },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex p-1.5 bg-slate-100/80 rounded-2xl w-fit mx-auto border border-slate-200 shadow-inner">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 ${
              view === tab.id
                ? "bg-white text-slate-900 shadow-md scale-105"
                : "text-slate-400 hover:text-slate-600"
            }`}>
            <span className="text-lg">{tab.icon}</span>
            <div className="text-left leading-none">
              <p className="text-xs font-black font-ethiopic">{tab.label}</p>
              <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">
                {tab.en}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[600px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}>
            {view === "REGISTRY" && (
              <div className="max-w-4xl mx-auto">
                <AuthorizeFathersForm />
              </div>
            )}
            {view === "LEDGER" && (
              <UnifiedDirectory initialData={initialData} />
            )}
            {view === "LOGS" && (
              <div className="text-center py-20 opacity-30 font-black tracking-widest uppercase text-xs">
                Coming Soon: System Audit Logs
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
