// src/features/father/components/ChildrenDirectory.tsx
"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  GraduationCap,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { StudentRecord } from "@/shared/types";
import { academicProgressFromEntry } from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

/** Compute a student's current year label for display. Legacy records without
 *  entryYear fall back to the stored academicYear value if present. */
function getAcademicProgress(child: StudentRecord & { entryYear?: number; programDuration?: number; gender?: string }) {
  const entryYear = child.entryYear ?? (child as any).entryYear;
  const programDuration = child.programDuration ?? (child as any).programDuration ?? 4;
  const gender: "MALE" | "FEMALE" = child.gender === "FEMALE" ? "FEMALE" : "MALE";

  if (entryYear) {
    return academicProgressFromEntry(entryYear, programDuration, gender);
  }

  // Legacy fallback — no entryYear stored, use academicYear number
  const yr: number = child.academicYear ?? 0;
  const isGraduated = yr >= programDuration;
  const gradLabel = gender === "FEMALE" ? "ትምህርቷን ጨርሳለች ✓" : "ትምህርቱን ጨርሷል ✓";

  return {
    graduated: isGraduated,
    onBreak: false,
    label: isGraduated ? gradLabel : yr ? `${yr}ኛ ዓመት` : "?",
    academicYear: yr,
    semester: 1 as const,
  };
}

export function ChildrenDirectory({ data }: { data: StudentRecord[] }) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    gender: "ALL",
    status: "ALL",
    graduated: "ALL", // "ALL" | "ACTIVE" | "GRADUATED"
  });

  const filteredChildren = useMemo(() => {
    return data
      .filter((child) => {
        const searchTerm = search.toLowerCase();
        const matchesSearch =
          (child.secularName || "").toLowerCase().includes(searchTerm) ||
          (child.fullName || "").toLowerCase().includes(searchTerm) ||
          (child.christianName || "").toLowerCase().includes(searchTerm) ||
          (child.eotcUid || "").toLowerCase().includes(searchTerm);

        const matchesGender =
          filters.gender === "ALL" || child.gender === filters.gender;
        const matchesStatus =
          filters.status === "ALL" ||
          (filters.status === "ACTIVE"
            ? child.accountClaimed
            : !child.accountClaimed);

        // Graduation filter — computed on the fly
        let matchesGraduated = true;
        if (filters.graduated !== "ALL") {
          const p = getAcademicProgress(child as any);
          matchesGraduated =
            filters.graduated === "GRADUATED" ? p.graduated : !p.graduated;
        }

        return matchesSearch && matchesGender && matchesStatus && matchesGraduated;
      })
      .sort((a, b) => {
        const nameA = (a.secularName || a.fullName).toLowerCase();
        const nameB = (b.secularName || b.fullName).toLowerCase();
        return nameA.localeCompare(nameB, "am");
      });
  }, [data, search, filters]);

  const handleCopy = (e: React.MouseEvent, id?: string) => {
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Search & Filter Bar - Mobile First (Stacked on <320px) */}
      <div className="flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative w-full">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="በስም ወይም በመለያ ይፈልጉ..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-200 outline-none font-ethiopic"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters - Horizontal scrollable on tiny screens */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <select
            title="filter by gender"
            className="flex-1 min-w-[100px] bg-slate-50 border-none rounded-lg text-[10px] font-black px-3 py-2.5 outline-none font-ethiopic"
            value={filters.gender}
            onChange={(e) =>
              setFilters({ ...filters, gender: e.target.value })
            }>
            <option value="ALL">ጾታ: ሁሉም</option>
            <option value="MALE">ወንድ</option>
            <option value="FEMALE">ሴት</option>
          </select>

          <select
            title="filter by graduation status"
            className="flex-1 min-w-[100px] bg-slate-50 border-none rounded-lg text-[10px] font-black px-3 py-2.5 outline-none font-ethiopic"
            value={filters.graduated}
            onChange={(e) => setFilters({ ...filters, graduated: e.target.value })}>
            <option value="ALL">ደረጃ: ሁሉም</option>
            <option value="ACTIVE">በትምህርት ላይ</option>
            <option value="GRADUATED">ምሩቃን 🎓</option>
          </select>

          <select
            title="filter by status"
            className="flex-1 min-w-[100px] bg-slate-50 border-none rounded-lg text-[10px] font-black px-3 py-2.5 outline-none font-ethiopic"
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }>
            <option value="ALL">ሁኔታ: ሁሉም</option>
            <option value="ACTIVE">የጸና (Active)</option>
            <option value="PENDING">በመጠባበቅ ላይ (Pending)</option>
          </select>
        </div>
      </div>

      <p className="px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
        በአጠቃላይ {filteredChildren.length} መንፈሳዊ ልጆች ተገኝተዋል
      </p>

      {/* Results Grid - Optimized for <320px */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredChildren.map((child) => (
          <Link
            key={child.eotcUid}
            href={`/father/children/${child.eotcUid}`}
            className="group block">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-5 sm:p-6 hover:shadow-xl transition-all active:scale-[0.98]">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-slate-50 overflow-hidden ring-1 ring-slate-100">
                  {child.photoUrl ? (
                    <img
                      src={child.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-full h-full p-3 text-slate-300" />
                  )}
                </div>
                <div
                  className={cn(
                    "px-2 py-1 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-tighter flex items-center gap-1",
                    child.accountClaimed
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  )}>
                  {child.accountClaimed ? (
                    <CheckCircle2 size={10} />
                  ) : (
                    <Clock size={10} />
                  )}
                  {child.accountClaimed ? "ACTIVE" : "PENDING"}
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 line-clamp-1">
                  {child.secularName || child.fullName}
                </h3>
                <p className="text-[11px] sm:text-xs font-bold text-amber-600 font-ethiopic">
                  {child.christianName}
                </p>
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 truncate">
                    <GraduationCap size={10} /> {child.university}
                  </span>
                  <span className={cn(
                    "text-[9px] font-black self-start px-2 py-0.5 rounded uppercase tracking-tighter",
                    getAcademicProgress(child as any).graduated
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700"
                  )}>
                    {getAcademicProgress(child as any).label}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleCopy(e, child.eotcUid)}
                className="w-full bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between active:bg-slate-700">
                <span className="text-[9px] font-mono text-amber-400">
                  {copiedId === child.eotcUid
                    ? "ተቀድቷል ✞"
                    : child.eotcUid || "መለያ የለም"}
                </span>
                <Copy
                  size={12}
                  className={copiedId === child.eotcUid ? "hidden" : "block"}
                />
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
