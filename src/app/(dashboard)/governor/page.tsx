// src/app/(dashboard)/governor/page.tsx

import { redirect } from "next/navigation";
import {
  FiAlertCircle,
  FiServer,
  FiShield,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import { getSession } from "@/core/auth/session.service";
import GovernorCommandCenter from "@/features/governor/components/GovernorCommandCenter";
import { GovernorSidebar } from "@/features/governor/components/GovernorSidebar";
import { adminDb } from "@/services/firebase/admin";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import {
  DirectoryRecord,
  FatherRecord,
  MetricCardProps,
  StudentRecord,
} from "@/shared/types";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const [fCountSnap, sCountSnap, fathersListSnap, studentsListSnap] =
      await Promise.all([
        adminDb.collection("Fathers").count().get(),
        adminDb.collection("Students").count().get(),
        adminDb
          .collection("Fathers")
          .orderBy("accessGrantedAt", "desc")
          .limit(50)
          .get(),
        adminDb
          .collection("Students")
          .orderBy("createdAt", "desc")
          .limit(50)
          .get(),
      ]);

    // 1. Map Father Records strictly
    const initialFathers: FatherRecord[] = fathersListSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        eotcUid: data.eotcUid || doc.id,
        fullName: data.fullName || "ያልታወቀ ስም",
        role: "FATHER",
        title: data.title || "ቀሲስ",
        status: data.status || "ACTIVE", // Use real status
        diocese: data.diocese || "ያልተጠቀሰ",
        parish: data.parish || "ያልተጠቀሰ",
        email: data.email || "",
        phone: data.phone || "",
        academics: data.academics || "N/A",
        languages: data.languages || [],
        accountClaimed: !!data.accountClaimed,
        createdAt:
          data.accessGrantedAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoUrl: data.photoUrl || undefined,
      };
    });

    // 2. Map Student Records strictly
    const initialStudents: StudentRecord[] = studentsListSnap.docs.map(
      (doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          eotcUid: data.eotcUid || doc.id,
          fullName: data.fullName || "ያልታወቀ ስም",
          role: "STUDENT",
          status: data.status || "ACTIVE", // Fix: No more mandatory pending fallback
          diocese: data.diocese || "ያልተጠቀሰ",
          university: data.university || "ያልታወቀ",
          department: data.department || "ያልተገለጸ",
          academicYear: data.academicYear || 1,
          spiritualFatherId: data.spiritualFatherId || "",
          fatherId: data.fatherId || "",
          language: data.language || "Amharic",
          accountClaimed: !!data.accountClaimed,
          createdAt:
            data.createdAt?.toDate?.().toISOString() ||
            new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    );

    return {
      fathersCount: fCountSnap.data().count,
      studentsCount: sCountSnap.data().count,
      initialData: [...initialFathers, ...initialStudents] as DirectoryRecord[],
      error: null,
    };
  } catch (err) {
    console.error("Dashboard Fetch Error:", err);
    return {
      fathersCount: 0,
      studentsCount: 0,
      initialData: [],
      error: "የመረጃ ስህተት ተከስቷል",
    };
  }
}

export default async function GovernorDashboard() {
  const session = await getSession();

  if (!session || session.role !== "GOVERNOR") {
    redirect("/unauthorized");
  }

  const { fathersCount, studentsCount, initialData, error } =
    await getDashboardData();

  return (
    <main className="relative min-h-screen bg-[#FDFCFB] overflow-x-hidden pb-20">
      <SanctuaryBackground />
      <GovernorSidebar />

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 xl:pl-80 transition-all">
        <header className="flex flex-col gap-4 mb-10 border-b border-amber-100 pb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              የአባቶች መመዝገቢያ እና የልጆች መቆጣጠሪያ
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-amber-700 uppercase tracking-[0.3em]">
                Governor Command Center
              </span>
              <div className="h-1 w-1 rounded-full bg-amber-300" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                v1.0 Secure
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
              System Live
            </span>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
          <MetricCard
            icon={<FiUsers className="w-5 h-5" />}
            label="Total Fathers"
            ethLabel="ጠቅላላ አባቶች"
            value={fathersCount}
            trend="+2 this week"
          />
          <MetricCard
            icon={<FiUserCheck className="w-5 h-5" />}
            label="Active Students"
            ethLabel="ንቁ ተማሪዎች"
            value={studentsCount}
            variant="dark"
          />
          <MetricCard
            icon={<FiServer className="w-5 h-5" />}
            label="Ledger Status"
            ethLabel="የመዝገብ ሁኔታ"
            value="Synced"
            isStatus
          />
        </section>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-xs font-bold flex items-center gap-3">
            <FiAlertCircle /> {error}
          </div>
        )}

        <section className="rounded-3xl shadow-sm border border-amber-100 bg-white/50 backdrop-blur-sm overflow-hidden">
          <GovernorCommandCenter initialData={initialData} />
        </section>
      </div>
    </main>
  );
}

// Fixed: icon is now React.ReactNode (no 'any')
function MetricCard({
  icon,
  label,
  ethLabel,
  value,
  variant = "light",
  trend,
  isStatus = false,
}: MetricCardProps & { ethLabel: string }) {
  const isDark = variant === "dark";

  return (
    <div
      className={`p-6 rounded-[1.5rem] border transition-all hover:translate-y-[-2px] ${
        isDark
          ? "bg-slate-900 border-slate-800 text-white shadow-xl"
          : "bg-white border-amber-50 text-slate-900 shadow-sm"
      }`}>
      <div className="flex justify-between items-start mb-6">
        <div
          className={`p-3 rounded-xl ${
            isDark
              ? "bg-slate-800 text-amber-400"
              : "bg-amber-50 text-amber-600"
          }`}>
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50/50 px-2 py-1 rounded-md">
            <FiTrendingUp className="w-3 h-3" /> {trend}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p
          className={`text-[10px] font-black uppercase tracking-widest ${
            isDark ? "opacity-50" : "text-amber-900/40"
          }`}>
          {ethLabel}
        </p>
        <div className="flex items-baseline gap-2">
          <p
            className={`text-4xl font-black tracking-tighter tabular-nums ${
              isStatus ? "text-xl sm:text-2xl" : ""
            }`}>
            {value}
          </p>
          <p className="text-[9px] font-bold opacity-30 uppercase tracking-tighter">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
