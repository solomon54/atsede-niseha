//src/features/student/components/StudentDashboardClient.tsx

"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Cross,
  GraduationCap,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { UserSession } from "@/shared/types/shared.types.auth";

interface StudentDashboardProps {
  profile: any;
  session: UserSession;
}

export default function StudentDashboardClient({
  profile,
  session,
}: StudentDashboardProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("atsede_niseha_uid");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="relative min-h-screen bg-[#fdfcf6] pb-12">
      <SanctuaryBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12 space-y-8">
        {/* 1. THE BLESSING (Header) */}
        <header className="flex justify-between items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-serif text-amber-900">
              እንኳን ደህና መጡ፣{" "}
              <span className="text-amber-600">{profile.christianName}</span>
            </h1>
            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-[0.3em] mt-2">
              የአፀደ ንስሐ ተማሪ መግቢያ
            </p>
          </motion.div>

          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200 hover:bg-red-50 hover:border-red-200 transition-all">
            <span className="text-[10px] font-bold text-amber-800 group-hover:text-red-700 uppercase">
              Logout
            </span>
            <LogOut className="w-4 h-4 text-amber-400 group-hover:text-red-500" />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 2. THE DIGITAL DIPTYCH (Profile Card) */}
          <div className="md:col-span-2 space-y-6">
            <SanctuarySurface className="p-8 border-t-4 border-t-amber-600 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Cross className="w-24 h-24" />
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="relative w-32 h-32 rounded-3xl border-4 border-amber-100 overflow-hidden shadow-inner bg-white">
                  {profile.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt="Profile"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-amber-50">
                      <GraduationCap className="w-12 h-12 text-amber-200" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {profile.fullName}
                    </h2>
                    <p className="text-amber-700 font-serif text-lg">
                      {profile.christianName}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-amber-50">
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      <GraduationCap className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">
                          University
                        </p>
                        <p className="text-xs font-medium text-gray-700">
                          {profile.university}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">
                          Joined Since
                        </p>
                        <p className="text-xs font-medium text-gray-700">
                          {profile.joinedAt || "መስከረም 2017"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SanctuarySurface>
          </div>

          {/* 3. SPIRITUAL LINK & STATUS */}
          <div className="space-y-6">
            <SanctuarySurface className="p-6 bg-amber-900 text-amber-50">
              <div className="flex items-center gap-3 mb-6 border-b border-amber-800 pb-4">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  Verification
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-amber-400 uppercase">
                    Status
                  </span>
                  <span className="text-[10px] font-bold bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30">
                    {profile.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-amber-400 uppercase">
                    Father Linked
                  </span>
                  <span className="text-[10px] font-bold text-amber-100">
                    {session.fatherId ? "VERIFIED" : "PENDING"}
                  </span>
                </div>
              </div>
            </SanctuarySurface>
          </div>
        </div>
      </div>
    </main>
  );
}
