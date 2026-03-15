//src/app/(dashboard)/page.tsx
"use client";

import { motion } from "framer-motion";
import { Bell, Quote, Sparkles, User } from "lucide-react";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";

// Mock Data for UI Building
const BROADCASTS = [
  {
    id: "1",
    type: "INSTRUCTION",
    title: "ስለ ጾም አስፈላጊነት",
    content:
      "ጾም ማለት ለሥጋ መገዛት ሳይሆን ለነፍስ ነጻነት የሚደረግ መንፈሳዊ ተጋድሎ ነው። በዚህ በዐቢይ ጾም ወቅት ልባችንን ወደ እግዚአብሔር እናቅርብ።",
    authorName: "መልአከ ሰላም ገብረ ማርያም",
    ethDate: "መጋቢት ፭ ቀን ፳፻፲፮",
    initials: "መሰ",
  },
  {
    id: "2",
    type: "LITURGICAL",
    title: "የደብረ ዘይት በዓል",
    content: "የፊታችን እሁድ የሚከበረው የደብረ ዘይት በዓል የጌታችንን ዳግም ምጽዓት የምናስብበት ታላቅ ቀን ነው።",
    authorName: "ዐጸደ ንስሐ - ማሳሰቢያ",
    ethDate: "መጋቢት ፯ ቀን ፳፻፲፮",
    isUrgent: true,
    initials: "ዐን",
  },
];

export default function CommonHousePage() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* ፩. Sacred Header - Following DSD Section 3.A */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-amber-100 pb-8 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">
            Digital Sanctuary Feed
          </p>
          <h1 className="text-4xl font-black text-slate-900 font-ethiopic tracking-tighter">
            የጋራ ቤት
          </h1>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Today
            </p>
            <p className="text-xs font-black text-slate-900 font-ethiopic">
              መጋቢት ፭ ቀን ፳፻፲፮
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
        </div>
      </header>

      {/* ፪. Broadcast Feed - DSD Section 3.B (Halo) & 3.C (Tactile) */}
      <div className="grid gap-8">
        {BROADCASTS.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.15,
              cubicBezier: [0.22, 1, 0.36, 1],
            }}>
            <SanctuarySurface className="p-0 overflow-hidden group hover:shadow-2xl hover:border-amber-200/50 transition-all duration-500 rounded-4xl">
              <div className="flex flex-col md:flex-row">
                {/* Visual Anchor (The Color Strip) */}
                <div
                  className={cn(
                    "w-full md:w-3 min-h-[8px] md:min-h-full transition-colors",
                    post.isUrgent
                      ? "bg-red-600"
                      : post.type === "INSTRUCTION"
                      ? "bg-amber-500"
                      : "bg-slate-900"
                  )}
                />

                <div className="p-8 md:p-10 flex-1 space-y-6">
                  {/* Meta Row */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {/* Mini Sacred Halo logic for the icon */}
                        <div className="absolute -inset-1 border border-amber-200/30 rounded-full border-dashed" />
                        <div className="relative p-2 bg-slate-50 rounded-full">
                          {post.type === "INSTRUCTION" ? (
                            <Quote className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Bell className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {post.type}
                      </span>
                    </div>

                    <div className="px-3 py-1 bg-amber-50 rounded-lg border border-amber-100/50">
                      <span className="text-[10px] font-bold text-amber-800 font-ethiopic">
                        {post.ethDate}
                      </span>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 font-ethiopic tracking-tight leading-tight">
                      {post.title}
                    </h2>
                    <p className="text-slate-600 text-lg leading-relaxed font-ethiopic font-medium max-w-3xl">
                      {post.content}
                    </p>
                  </div>

                  {/* Signature Section - DSD Section 3.B (Mini Profile Frame) */}
                  <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-full p-0.5 bg-linear-to-b from-amber-400 to-amber-100">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                          <span className="text-[10px] font-black font-ethiopic text-slate-400">
                            {post.initials}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Authoritative Word
                        </span>
                        <span className="text-xs font-black text-slate-900 uppercase">
                          {post.authorName}
                        </span>
                      </div>
                    </div>

                    <button
                      title="sparkle"
                      className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all active:scale-90">
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </SanctuarySurface>
          </motion.div>
        ))}
      </div>

      {/* Footer Note */}
      <footer className="py-12 text-center">
        <div className="inline-block p-1 bg-amber-100/30 rounded-full mb-4">
          <div className="px-4 py-1 border border-amber-200/50 rounded-full">
            <p className="text-[8px] font-black text-amber-800 uppercase tracking-[0.5em]">
              Sacred Instruction End
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
