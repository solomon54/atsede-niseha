// src/app/(dashboard)/governor/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FiActivity,
  FiAlertCircle,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

// Components
import GovernorCommandCenter from "@/features/governor/components/GovernorCommandCenter";
// Data & Types
import { adminDb } from "@/services/firebase/admin";
import {
  DirectoryRecord,
  MetricCardProps,
  StatusBadgeProps,
} from "@/shared/types";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    // 1. Fetching counts and initial registry lists in parallel
    const [fCountSnap, sCountSnap, fathersListSnap, studentsListSnap] =
      await Promise.all([
        adminDb.collection("Fathers").count().get(),
        adminDb.collection("Students").count().get(),
        adminDb
          .collection("Fathers")
          .orderBy("accessGrantedAt", "desc")
          .limit(100)
          .get(),
        adminDb
          .collection("Students")
          .orderBy("accessGrantedAt", "desc")
          .limit(100)
          .get(),
      ]);

    // 2. Mapping Fathers (ConfessorRecord)
    const initialFathers: DirectoryRecord[] = fathersListSnap.docs.map(
      (doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          eotcUid: data.eotcUid || doc.id,
          fullName: data.fullName || "ያልታወቀ ስም",
          diocese: data.diocese || "ያልተጠቀሰ",
          status: data.status || "PENDING",
          role: "FATHER",

          title: data.title || "ቀሲስ",
          parish: data.parish || "ያልተጠቀሰ",
          phone: data.phone || "N/A",
          email: data.email || "N/A",
          academics: data.academics || "N/A",
          languages: data.languages || [],
          photoUrl: data.photoUrl || null,
          accountClaimed: data.accountClaimed ?? false,
          createdAt:
            data.accessGrantedAt?.toDate?.()?.toISOString() ||
            new Date().toISOString(),
        } as DirectoryRecord;
      }
    );

    // 3. Mapping Students (StudentRecord) - Tracking Academic Year
    const initialStudents: DirectoryRecord[] = studentsListSnap.docs.map(
      (doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          eotcUid: data.eotcUid || doc.id,
          fullName: data.fullName || "ያልታወቀ ስም",
          diocese: data.diocese || "ያልተጠቀሰ",
          status: data.status || "PENDING",
          role: "STUDENT",
          university: data.university || "ያልታወቀ",
          department: data.department || "ያልተገለጸ",
          academicYear: data.academicYear || 1,
          accountClaimed: data.accountClaimed ?? false,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() ||
            new Date().toISOString(),
        } as DirectoryRecord;
      }
    );

    return {
      fathersCount: fCountSnap.data().count,
      studentsCount: sCountSnap.data().count,
      initialData: [...initialFathers, ...initialStudents], // Combined registry
      error: null,
    };
  } catch (err) {
    console.error("DASHBOARD_FETCH_ERROR:", err);
    return {
      fathersCount: 0,
      studentsCount: 0,
      initialData: [],
      error: "የመረጃ ስህተት ተከስቷል",
    };
  }
}

export default async function GovernorDashboard() {
  const headerList = await headers();
  if (headerList.get("x-ats-role") !== "GOVERNOR") redirect("/unauthorized");

  const { fathersCount, studentsCount, initialData, error } =
    await getDashboardData();

  return (
    <main className="min-h-screen bg-[#FDFCFB]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-8 space-y-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-amber-100 pb-8">
          <div>
            <h1 className="text-3xl font-black font-ethiopic text-slate-900 tracking-tight">
              የበላይ መቆጣጠሪያ
            </h1>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.4em] mt-1">
              Governor Control Center
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge
              icon={<FiShield />}
              label="Gatekeeper"
              value="Active"
            />
          </div>
        </header>

        {/* Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={<FiUsers />}
            label="Ordained Fathers"
            value={fathersCount}
            variant="dark"
          />
          <MetricCard
            icon={<FiUserCheck />}
            label="Covenanted Students"
            value={studentsCount}
          />
          <MetricCard
            icon={<FiShield />}
            label="System Security"
            value="Secure"
          />
        </section>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 font-bold flex items-center gap-3">
            <FiAlertCircle /> {error}
          </div>
        )}

        {/* The Client-Side Command Center (Tabs live here) */}
        <GovernorCommandCenter initialData={initialData} />
      </div>
    </main>
  );
}

/* --- Internal UI Components --- */

function MetricCard({
  icon,
  label,
  value,
  variant = "light",
}: MetricCardProps) {
  const isDark = variant === "dark";
  return (
    <div
      className={`p-8 rounded-[2rem] transition-all hover:shadow-xl border ${
        isDark
          ? "bg-slate-900 border-slate-800 text-white"
          : "bg-white border-slate-100 text-slate-900"
      }`}>
      <div
        className={`text-2xl mb-4 ${
          isDark ? "text-amber-400" : "text-amber-600"
        }`}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
        {label}
      </p>
      <p className="text-5xl font-black mt-1 tabular-nums tracking-tighter">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ icon, label, value }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-full">
      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">
        {value}
      </span>
    </div>
  );
}
