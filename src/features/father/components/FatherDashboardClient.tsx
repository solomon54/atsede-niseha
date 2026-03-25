// src/features/father/components/FatherDashboardClient.tsx

"use client";

import {
  Church,
  LayoutDashboard,
  Loader2,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

import RegisterChildForm from "@/features/father/components/RegisterChildForm";
import { GovernorSidebar } from "@/features/governor/components/GovernorSidebar";
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { StudentRecord } from "@/shared/types/index";
import { cn } from "@/shared/utils/utils";

import { useChildren } from "../hooks/useChildren";
import { ChildrenDirectory } from "./ChildrenDirectory";

/**
 * Tabs — compact + readable
 */
const TABS = [
  { id: "overview", label: "አጠቃላይ", icon: LayoutDashboard },
  { id: "directory", label: "የልጆች ዝርዝር", icon: Users },
  { id: "register", label: "አዲስ ልጅ መመዝገቢያ", icon: UserPlus },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  fatherId: string;
  fatherEotcId: string;
  isManagementMode?: boolean;
}

export default function FatherDashboardClient({
  fatherId,
  fatherEotcId,
  isManagementMode = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const { data, loading, refetch } = useChildren(fatherEotcId);
  const children = (data || []) as StudentRecord[];

  return (
    <ImmersiveTransition className="pt-3 pb-6 px-3 sm:px-5 md:px-8 relative min-h-screen">
      {isManagementMode && <GovernorSidebar />}

      {/* subtle background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-amber-100/10 blur-[100px]" />
      </div>

      <div
        className={cn(
          "relative z-10 max-w-6xl mx-auto transition-all duration-500",
          isManagementMode && "xl:ml-80"
        )}>
        {/* MANAGEMENT MODE */}
        {isManagementMode && (
          <div className="mb-4 flex items-center justify-between bg-slate-900 text-amber-200 px-4 py-2 rounded-xl border border-amber-900/20">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest">
                የበላይ ቁጥጥር — {fatherEotcId}
              </span>
            </div>
          </div>
        )}

        {/* HEADER (compressed) */}
        <header className="mb-5 flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white border border-amber-50 rounded-xl flex items-center justify-center shadow-sm">
            <Church className="text-amber-600 w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0">
            <h1 className="text-[clamp(1rem,5vw,1.3rem)] font-black text-slate-900 truncate leading-none">
              ዐጸደ ንስሐ
            </h1>
            <p className="text-[8px] font-bold text-amber-700 uppercase tracking-[0.25em] truncate">
              መንፈሳዊ መዝገብ
            </p>
          </div>
        </header>

        {/* TABS (ultra compact) */}
        <nav className="flex items-center gap-1 p-1 bg-slate-100/60 backdrop-blur rounded-2xl mb-5 overflow-x-auto no-scrollbar border border-white/60">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 min-w-[80px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl transition-all",
                  isActive
                    ? "bg-white text-slate-900 shadow border border-amber-100"
                    : "text-slate-500"
                )}>
                <Icon
                  className={cn(
                    "w-3.5 h-3.5",
                    isActive ? "text-amber-600" : "text-slate-400"
                  )}
                />
                <span className="text-[9px] font-bold uppercase tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* MAIN CONTENT */}
        <main>
          <SanctuarySurface className="p-4 sm:p-6 md:p-8 min-h-[380px] relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
                <Loader2 className="animate-spin text-amber-600 mb-3 h-5 w-5" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  መረጃ በመጫን ላይ...
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <OverviewContent count={children.length} />
                )}

                {/* DIRECTORY */}
                {activeTab === "directory" && (
                  <ChildrenDirectory data={children} />
                )}

                {/* REGISTER */}
                {activeTab === "register" && (
                  <div className="max-w-2xl mx-auto">
                    <RegisterChildForm
                      fatherId={fatherId}
                      fatherEotcId={fatherEotcId}
                      onSuccess={() => {
                        refetch();
                        setActiveTab("directory");
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </SanctuarySurface>

          {/* FOOTER (tight) */}
          <footer className="mt-6 flex flex-col items-center gap-1.5">
            <div className="h-[1px] w-8 bg-amber-200/50" />
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest text-center px-3">
              መዝገበ ሃይማኖት — {new Date().getFullYear() - 8} ዓ.ም
            </p>
          </footer>
        </main>
      </div>
    </ImmersiveTransition>
  );
}

/**
 * OVERVIEW — compact + premium
 */
function OverviewContent({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* TOTAL */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-slate-900 text-white shadow-lg">
        <Users className="absolute -top-3 -right-3 w-20 h-20 text-white/5 rotate-12" />

        <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-2">
          ጠቅላላ ልጆች
        </p>

        <div className="flex items-end gap-2">
          <span className="text-3xl sm:text-4xl font-black leading-none">
            {count}
          </span>
          <span className="text-[9px] font-bold text-slate-400 pb-0.5">
            ልጆች
          </span>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 flex flex-col items-center justify-center text-center">
        <ScrollText className="text-slate-300 w-4 h-4 mb-1.5" />
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
          መልዕክቶች
        </p>
        <p className="text-lg font-black text-slate-300">0</p>
      </div>
    </div>
  );
}
