// src/features/father/components/SpiritualTimeline.tsx

import { CalendarDays, Cross, Flame, History, ShieldCheck } from "lucide-react";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

export default function SpiritualTimeline({ student }: { student: any }) {
  // Mock data for demonstration - this would come from the 'spiritualEvents' collection [cite: 55]
  const milestones = [
    {
      type: "EUCHARIST",
      date: "2016-06-12",
      label: "ቅዱስ ቁርባን (Holy Communion)",
      location: "Holy Trinity Cathedral",
    },
    {
      type: "PENANCE",
      date: "2016-04-01",
      label: "ንስሐ (Penance)",
      location: "Personal Confession",
    },
    {
      type: "ONBOARDING",
      date: "2016-03-18",
      label: "ወደ ዓጸደ ንስሐ ተቀላቀለ (Joined Sanctuary)",
      location: "System",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between px-2">
        <div>
          <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">
            Life Archives
          </p>
          <h3 className="text-2xl font-black text-slate-900 font-ethiopic">
            የመንፈስ ጉዞ (Spiritual Timeline)
          </h3>
        </div>
        <div className="p-3 bg-slate-100 rounded-full text-slate-400">
          <History size={20} />
        </div>
      </header>

      <div className="relative pl-8 space-y-12">
        {/* The Vertical "Incense" Line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-linear-to-b from-amber-500 via-amber-200 to-transparent" />

        {milestones.map((event, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline Node */}
            <div className="absolute -left-[27px] top-0 w-4 h-4 rounded-full border-4 border-[#fdfcf6] bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10 group-hover:scale-125 transition-transform" />

            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-4 rounded-2xl",
                      event.type === "EUCHARIST"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-slate-50 text-slate-600"
                    )}>
                    {event.type === "EUCHARIST" ? (
                      <Flame size={24} />
                    ) : (
                      <Cross size={24} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 font-ethiopic">
                      {event.label}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {event.location}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1 rounded-lg">
                    <CalendarDays size={14} />
                    <span className="text-xs font-black">{event.date} ዓ.ም</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
