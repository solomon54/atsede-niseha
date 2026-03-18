// src/features/father/components/ChildrenDirectory.tsx
"use client";

import {
  ArrowUpRight, // New icon for visual cue
  CheckCircle2,
  Clock,
  Copy,
  GraduationCap,
  Search,
  User,
} from "lucide-react";
import Link from "next/link"; // Required for navigation
import { useMemo, useState } from "react";

import { StudentRecord } from "@/shared/types";
import { cn } from "@/shared/utils/utils";

export function ChildrenDirectory({ data }: { data: StudentRecord[] }) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    gender: "ALL",
    status: "ALL",
  });

  const filteredChildren = useMemo(() => {
    return data.filter((child) => {
      // Use secularName or fullName depending on your registration data
      const nameToSearch = (
        child.secularName ||
        child.fullName ||
        ""
      ).toLowerCase();
      const matchesSearch =
        nameToSearch.includes(search.toLowerCase()) ||
        child.eotcUid?.toLowerCase().includes(search.toLowerCase());

      const matchesGender =
        filters.gender === "ALL" || child.gender === filters.gender;
      const matchesStatus =
        filters.status === "ALL" ||
        (filters.status === "CLAIMED"
          ? child.accountClaimed
          : !child.accountClaimed);

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [data, search, filters]);

  const handleCopy = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevents the Link from triggering when copying
    e.stopPropagation(); // Prevents bubbling to the card link
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ... (Search & Filter Bar remains same) ... */}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChildren.map((child) => (
          <Link
            key={child.eotcUid}
            href={`/father/children/${child.eotcUid}`}
            className="group relative block">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 hover:shadow-2xl hover:border-amber-200 transition-all duration-500 hover:-translate-y-1">
              {/* Premium Hover Indicator */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight size={20} className="text-amber-500" />
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100">
                  {child.photoUrl ? (
                    <img
                      src={child.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-full h-full p-4 text-slate-300" />
                  )}
                </div>

                <div
                  className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5",
                    child.accountClaimed
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  )}>
                  {child.accountClaimed ? (
                    <CheckCircle2 size={10} />
                  ) : (
                    <Clock size={10} />
                  )}
                  {child.accountClaimed ? "Active" : "Pending"}
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <h3 className="text-sm font-black text-slate-800">
                  {child.secularName || child.fullName}
                </h3>
                <p className="text-xs font-bold text-amber-600 font-ethiopic">
                  {child.christianName}
                </p>
                <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <GraduationCap size={12} /> {child.university}
                </p>
              </div>

              {/* Copyable ID Box - Note the e.stopPropagation in handleCopy */}
              <div className="relative pt-2">
                <button
                  onClick={(e) => handleCopy(e, child.eotcUid)}
                  className="w-full bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between hover:bg-slate-800 transition-colors">
                  <span className="text-[9px] font-mono tracking-tighter text-amber-400">
                    {copiedId === child.eotcUid ? "ተቀድቷል ✞" : child.eotcUid}
                  </span>
                  <Copy
                    size={14}
                    className={cn(
                      "transition-all",
                      copiedId === child.eotcUid
                        ? "scale-0 opacity-0"
                        : "scale-100 opacity-100"
                    )}
                  />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
