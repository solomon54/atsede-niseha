//src/features/governor/components/UnifiedDirectory.tsx
"use client";

import { useState } from "react";
import { FiExternalLink, FiMoreVertical, FiSearch } from "react-icons/fi";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { DirectoryRecord } from "@/shared/types";

type DirectoryTab = "CONFESSORS" | "HELPERS" | "LOGS";

interface UnifiedDirectoryProps {
  initialData: DirectoryRecord[];
}

export default function UnifiedDirectory({
  initialData,
}: UnifiedDirectoryProps) {
  const [activeTab, setActiveTab] = useState<DirectoryTab>("CONFESSORS");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { id: DirectoryTab; amh: string; en: string }[] = [
    { id: "CONFESSORS", amh: "መምህራን", en: "Confessors" },
    { id: "HELPERS", amh: "ረዳቶች", en: "Helpers" },
    { id: "LOGS", amh: "ሎጆች", en: "Logs" },
  ];

  // Type-safe filtering
  const filteredData = initialData.filter((item) => {
    const matchesTab =
      (activeTab === "CONFESSORS" && item.role === "CONFESSOR") ||
      (activeTab === "HELPERS" && item.role === "HELPER") ||
      (activeTab === "LOGS" && item.role === "LOG");

    const matchesSearch =
      item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.diocese.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <SanctuarySurface>
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-100 space-y-5">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
          <FiSearch className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="በስም ወይም በሀገረ ስብከት ፈልግ..."
            className="bg-transparent border-none outline-none text-sm font-ethiopic w-full text-slate-700"
          />
        </div>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start px-5 py-2 rounded-xl transition-all border ${
                activeTab === tab.id
                  ? "bg-slate-900 border-slate-900 shadow-lg translate-y-[-1px]"
                  : "bg-white border-slate-100 hover:bg-slate-50"
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 sticky top-0 z-10">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="px-6 py-4">መለያ ስም (Name)</th>
              <th className="px-6 py-4">ሀገረ ስብከት (Diocese)</th>
              <th className="px-6 py-4">ሁኔታ (Status)</th>
              <th className="px-6 py-4 text-right">ድርጊት (Action)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-24 text-center">
                  <div className="flex flex-col items-center opacity-20">
                    <span className="text-4xl mb-2">📜</span>
                    <p className="text-xs font-black uppercase tracking-widest">
                      No Records Found
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((record) => (
                <tr
                  key={record.uid}
                  className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-black text-slate-700 font-ethiopic">
                    {record.fullName}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {record.diocese}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        record.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      title="link"
                      className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all text-slate-400 hover:text-amber-600">
                      <FiExternalLink />
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
