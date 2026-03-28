//src/features/governor/components/UnifiedDirectory.tsx
"use client";

import { useMemo, useState } from "react";
import { FiExternalLink, FiSearch } from "react-icons/fi";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { DirectoryRecord, StudentRecord } from "@/shared/types";

type DirectoryTab = "FATHERS" | "CHILDREN" | "BIG_OTHERS";

interface UnifiedDirectoryProps {
  initialFathers: DirectoryRecord[];
  initialStudents: DirectoryRecord[];
}

export default function UnifiedDirectory({
  initialFathers = [],
  initialStudents = [],
}: UnifiedDirectoryProps) {
  const [activeTab, setActiveTab] = useState<DirectoryTab>("FATHERS");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { id: "FATHERS" as const, amh: "መምህራን", en: "Confessors/Fathers" },
    { id: "CHILDREN" as const, amh: "ልጆች", en: "Students & Helpers" },
    {
      id: "BIG_OTHERS" as const,
      amh: "ታላቅ ውንድም/እህት",
      en: "Big brother/Sister",
    },
  ];

  // 1. Safe Data Selection
  const activeData = useMemo(() => {
    switch (activeTab) {
      case "CHILDREN":
        return initialStudents;
      case "FATHERS":
        return initialFathers;
      case "BIG_OTHERS":
        return [];
      default:
        return [];
    }
  }, [activeTab, initialFathers, initialStudents]);

  // 2. Defensive Filtering (prevents "No Data" caused by JS crashes)
  const filteredData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return activeData.filter((item) => {
      if (!searchLower) return true;

      // Safe string conversion to handle null/undefined from DB
      const name = item.fullName?.toLowerCase() || "";
      const diocese = item.diocese?.toLowerCase() || "";
      const id = item.eotcUid?.toLowerCase() || "";

      return (
        name.includes(searchLower) ||
        diocese.includes(searchLower) ||
        id.includes(searchLower)
      );
    });
  }, [activeData, searchQuery]);

  return (
    <SanctuarySurface>
      {/* Search Header */}
      <div className="p-5 border-b border-slate-100 space-y-5">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl transition-all focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/50">
          <FiSearch className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="በስም፣ በመለያ ወይም በሀገረ ስብከት ፈልግ..."
            className="bg-transparent border-none outline-none text-sm font-ethiopic w-full text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start px-6 py-2 rounded-xl transition-all border ${
                activeTab === tab.id
                  ? "bg-slate-900 border-slate-900 shadow-lg scale-[1.02]"
                  : "bg-white border-slate-100 hover:bg-slate-50 text-slate-400"
              }`}>
              <span
                className={`text-xs font-black font-ethiopic ${
                  activeTab === tab.id ? "text-white" : "text-slate-700"
                }`}>
                {tab.amh}
              </span>
              <span
                className={`text-[8px] uppercase tracking-widest font-bold ${
                  activeTab === tab.id ? "text-amber-400" : "text-slate-400"
                }`}>
                {tab.en}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto min-h-[400px]">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="px-6 py-4 border-b border-slate-100">
                መለያና ስም (ID & Name)
              </th>
              <th className="px-6 py-4 border-b border-slate-100">
                {activeTab === "CHILDREN"
                  ? "ትምህርት (Academic)"
                  : "ሀገረ ስብከት (Diocese)"}
              </th>
              <th className="px-6 py-4 border-b border-slate-100">
                ሁኔታ (Status)
              </th>
              <th className="px-6 py-4 text-right border-b border-slate-100">
                ድርጊት
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-32 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <FiSearch className="text-4xl" />
                    <p className="text-xs font-black font-ethiopic">
                      ምንም መረጃ አልተገኘም
                    </p>
                    <p className="text-[10px] uppercase tracking-widest">
                      No Records Found
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((record) => (
                <tr
                  key={record.uid}
                  className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-amber-700 font-bold group-hover:text-amber-600">
                        {record.eotcUid || "NO-ID"}
                      </span>
                      <span className="text-sm font-black text-slate-700 font-ethiopic">
                        {record.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {activeTab === "CHILDREN" ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">
                          {(record as StudentRecord).university || "N/A"}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {(record as StudentRecord).department || "Unknown"} —
                          Year {(record as StudentRecord).academicYear || "?"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {record.diocese || "የማይታወቅ"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[9px] font-black px-3 py-1 rounded-full border ${
                        record.accountClaimed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                      {record.accountClaimed ? "ACTIVE" : "PENDING"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      title="link"
                      className="p-2 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                      <FiExternalLink className="text-lg" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SanctuarySurface>
  );
}
