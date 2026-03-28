"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

// Update the interface to match our Pre-registration fields
interface FatherRecord {
  eotcUid: string; // The EOTC-ID
  fullName: string;
  title: string;
  diocese: string;
  parish: string;
  phone: string;
  email: string;
  academics: string;
  secularTitle?: string;
  languages: string[];
  accountClaimed: boolean; // From our new service logic
  photoUrl?: string; // From Cloudinary
}

interface Props {
  initialData: FatherRecord[];
}

export default function FathersDirectoryTable({ initialData }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFather, setSelectedFather] = useState<FatherRecord | null>(
    null
  );
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const filteredData = initialData.filter(
    (f) =>
      f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.diocese.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.eotcUid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* SEARCH BAR */}
      <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white/20 shadow-sm">
        <input
          type="text"
          placeholder="በስም፣ በመለያ ወይም በሀገረ ስብከት ይፈልጉ..."
          className="bg-transparent border-none outline-none text-sm font-ethiopic w-full text-slate-900"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="text-[10px] font-black text-slate-400 px-3 uppercase tracking-widest">
          Search
        </span>
      </div>

      <SanctuarySurface>
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.2em]">
              <tr>
                <th className="px-6 py-4">ማዕረግና ስም</th>
                <th className="px-6 py-4">መለያ (ID)</th>
                <th className="px-6 py-4">ሁኔታ (Status)</th>
                <th className="px-6 py-4 text-right">ድርጊት</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((father) => (
                <tr
                  key={father.eotcUid}
                  className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* Show Cloudinary Photo if it exists */}
                      {father.photoUrl ? (
                        <img
                          src={father.photoUrl}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">
                          ✞
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800 font-ethiopic">
                          {father.title} {father.fullName}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {father.diocese}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px]">
                    {visibleKeys[father.eotcUid] ? father.eotcUid : "••••••••"}
                    <button
                      onClick={() =>
                        setVisibleKeys((prev) => ({
                          ...prev,
                          [father.eotcUid]: !prev[father.eotcUid],
                        }))
                      }
                      className="ml-2 opacity-30 group-hover:opacity-100">
                      {visibleKeys[father.eotcUid] ? "🔒" : "👁️"}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${
                        father.accountClaimed
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                      {father.accountClaimed ? "Claimed" : "Pending Claim"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedFather(father)}
                      className="text-[10px] font-black text-blue-600 uppercase hover:underline">
                      ዝርዝር
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SanctuarySurface>

      {/* DETAIL MODAL remains the same, just ensure it uses selectedFather.eotcUid */}
      <AnimatePresence>
        {selectedFather && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* ... same modal code as your provided snippet ... */}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
