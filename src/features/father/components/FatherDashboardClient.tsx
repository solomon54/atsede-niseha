//src/features/father/components/FatherDashboardClient.tsx

"use client";

import { LayoutDashboard, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import RegisterChildForm from "@/features/father/components/RegisterChildForm";
import { GovernorSidebar } from "@/features/governor/components/GovernorSidebar"; // Import Sidebar
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";

const TABS = [
  { id: "overview", label: "አጠቃላይ", icon: LayoutDashboard },
  { id: "register", label: "ልጆችን መመዝገቢያ", icon: UserPlus },
  { id: "directory", label: "የልጆች ዝርዝር", icon: Users },
];

interface FatherDashboardClientProps {
  fatherId: string;
  fatherEotcId: string;
  isManagementMode?: boolean;
}

export default function FatherDashboardClient({
  fatherId,
  fatherEotcId,
  isManagementMode = false,
}: FatherDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <ImmersiveTransition className="pt-24 pb-12 px-4 md:px-8 relative min-h-screen">
      {/* 1. Governor Sidebar: Only visible for Governors */}
      {isManagementMode && <GovernorSidebar />}

      {/* Premium Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-100/20 blur-[100px] transform-gpu" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-slate-200/30 blur-[100px] transform-gpu" />
      </div>

      {/* 2. Main Content Wrapper: Adjusts margin if Sidebar is present */}
      <div
        className={cn(
          "relative z-10 max-w-6xl mx-auto transition-all duration-500",
          isManagementMode && "xl:ml-80 xl:max-w-none pr-4"
        )}>
        {/* Governor Management Banner */}
        {isManagementMode && (
          <div className="mb-6 flex items-center justify-between bg-amber-950 text-amber-200 px-6 py-3 rounded-2xl border border-amber-800/50 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                System Management Mode — Viewing Father: {fatherEotcId}
              </span>
            </div>
            <div className="px-3 py-1 bg-amber-900/50 rounded-lg border border-amber-700/30 text-[9px] font-bold">
              GOVERNOR ACCESS
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-12 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white shadow-lg border border-amber-100 rounded-2xl">
              <span className="text-xl text-amber-600 font-black">✞</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter font-ethiopic">
                ዐጸደ ንስሐ
              </h1>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.4em]">
                Priestly Management Sanctuary
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <nav className="space-y-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold text-sm uppercase tracking-widest cursor-pointer",
                    isActive
                      ? "bg-slate-950 text-white shadow-2xl shadow-slate-950/20 translate-x-2"
                      : "bg-white/60 text-slate-500 hover:bg-white hover:text-slate-950 border border-transparent hover:border-slate-100"
                  )}>
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      isActive ? "text-amber-400" : "text-slate-400"
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Dynamic Content Area */}
          <main className="lg:col-span-3">
            <SanctuarySurface className="p-8 min-h-[600px] flex flex-col relative">
              {activeTab === "overview" && <OverviewContent />}

              {activeTab === "register" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      የንስሐ ልጅ ምዝገባ
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      አዲስ መንፈሳዊ ልጅን ወደ ዐጸደ ንስሐ ያስገቡ
                    </p>
                  </div>

                  <RegisterChildForm
                    fatherId={fatherId}
                    fatherEotcId={fatherEotcId}
                  />
                </div>
              )}

              {activeTab === "directory" && <DirectoryContent />}
            </SanctuarySurface>

            <footer className="mt-8 text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
              By using this portal, you uphold the{" "}
              <span className="text-amber-800">Covenant of Secrecy</span>
            </footer>
          </main>
        </div>
      </div>
    </ImmersiveTransition>
  );
}

/**
 * Overview Section: Displays summary metrics.
 */
function OverviewContent() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 border-b border-slate-50 pb-4">
        የመቆጣጠሪያ ሰሌዳ
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:border-amber-200 transition-colors">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            ጠቅላላ የንስሐ ልጆች
          </p>
          <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">
            0
          </p>
        </div>
        <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:border-amber-200 transition-colors">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            ያልተነበቡ ማስታወሻዎች
          </p>
          <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">
            0
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Directory Section: Lists registered children.
 */
function DirectoryContent() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
        <Users className="w-8 h-8 text-slate-200" />
      </div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
        እስካሁን ምንም የተመዘገበ ልጅ የለም
      </p>
    </div>
  );
}
