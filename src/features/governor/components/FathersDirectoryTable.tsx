"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FatherRecord } from "@/shared/types";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

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
      f.diocese.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-white/20">
        <input
          type="text"
          placeholder="በስም ወይም በሀገረ ስብከት ይፈልጉ..."
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
                <th className="px-6 py-4">መለያ</th>
                <th className="px-6 py-4 text-right">ድርጊት</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((father) => (
                <tr
                  key={father.uid}
                  className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 font-ethiopic">
                        {father.title} {father.fullName}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {father.diocese}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px]">
                    {visibleKeys[father.uid] ? father.uid : "••••••••"}
                    <button
                      onClick={() =>
                        setVisibleKeys((prev) => ({
                          ...prev,
                          [father.uid]: !prev[father.uid],
                        }))
                      }
                      className="ml-2 opacity-30 group-hover:opacity-100">
                      {visibleKeys[father.uid] ? "🔒" : "👁️"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedFather(father)}
                      className="text-[10px] font-black text-blue-600 uppercase hover:underline">
                      ዝርዝር (Detail)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SanctuarySurface>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedFather && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFather(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden">
              <div className="h-32 bg-slate-900 flex items-end p-8 relative">
                <div className="absolute top-6 right-8 text-white/20 text-4xl">
                  ✞
                </div>
                <h2 className="text-white text-2xl font-black font-ethiopic">
                  የመምህር መረጃ (Full Profile)
                </h2>
              </div>

              <div className="p-8 grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <DetailItem
                    label="ሙሉ ስም"
                    value={`${selectedFather.title} ${selectedFather.fullName}`}
                  />
                  <DetailItem
                    label="ዓለማዊ ማዕረግ"
                    value={selectedFather.secularTitle || "N/A"}
                  />
                  <DetailItem
                    label="የትምህርት ዝግጅት"
                    value={selectedFather.academics}
                  />
                  <DetailItem
                    label="የሚያገለግሉበት ሀገረ ስብከት"
                    value={selectedFather.diocese}
                  />
                </div>
                <div className="space-y-4">
                  <DetailItem label="ደብር/ገዳም" value={selectedFather.parish} />
                  <DetailItem label="ስልክ ቁጥር" value={selectedFather.phone} />
                  <DetailItem label="ኢሜይል" value={selectedFather.email} />
                  <DetailItem
                    label="ቋንቋዎች"
                    value={selectedFather.languages.join(", ")}
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedFather(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">
                  Close Registry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800 font-ethiopic">{value}</p>
    </div>
  );
}
