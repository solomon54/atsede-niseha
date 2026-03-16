//src/features/governor/components/GovernorSidebar.tsx

"use client";

import { Menu, Search, X, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DirectoryRecord } from "@/shared/types";

/**
 * GOVERNOR SIDEBAR (Sovereign Switcher)
 * Provides global navigation and impersonation capabilities for Governors.
 * Handles path-trimming logic to ensure the target is always routed to the
 * correct dashboard context.
 */
export function GovernorSidebar() {
  const [fathers, setFathers] = useState<DirectoryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/governor/fathers")
      .then((res) => res.json())
      .then((data: DirectoryRecord[]) => setFathers(data))
      .catch((err) => console.error("Sidebar Fetch Error:", err));
  }, []);

  /**
   * SOVEREIGN FILTER FIX:
   * Uses optional chaining and null-coalescing (?? "") to prevent
   * the 'possibly undefined' TypeScript error (ts18048).
   */
  const filtered = fathers.filter(
    (f) =>
      f.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (f.eotcUid ?? "").toLowerCase().includes(search.toLowerCase())
  );

  /**
   * Path Resolution Logic
   * Ensures that clicking a father always directs to a valid dashboard.
   * If current path is management-based, it stays; otherwise, it defaults to /father.
   */
  const handleSwitch = (targetUid: string) => {
    let baseTarget = pathname;

    if (pathname.startsWith("/governor") || pathname === "/") {
      baseTarget = "/father";
    }

    router.push(`${baseTarget}?target=${targetUid}`);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-600 text-white rounded-full flex items-center justify-center shadow-2xl z-[60] xl:hidden border-2 border-amber-400 transition-transform active:scale-95">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <div
        className={`
        fixed left-4 top-24 bottom-4 w-72 bg-slate-950 rounded-[2rem] border border-amber-500/20 p-6 flex flex-col z-50 shadow-2xl overflow-hidden transition-all duration-500 ease-in-out
        ${
          isOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-[120%] xl:translate-x-0"
        }
        xl:flex
      `}>
        <div className="flex items-center gap-2 mb-6">
          <Zap size={16} className="text-amber-500" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            Sovereign Switcher
          </span>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={14}
          />
          <input
            type="text"
            placeholder="Search Father..."
            className="w-full bg-slate-900 border-none rounded-xl py-3 pl-10 pr-4 text-[11px] text-white outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map((father) => (
              <button
                key={father.uid}
                onClick={() => handleSwitch(father.uid)}
                className={`
                  w-full group flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent hover:border-amber-500/20 text-left relative
                  ${
                    pathname.includes(father.uid)
                      ? "bg-amber-500/20 border-amber-500/40"
                      : "hover:bg-amber-500/10"
                  }
                `}>
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-amber-500 font-bold text-sm border border-slate-700 group-hover:border-amber-500/50 transition-colors shrink-0">
                  {father.fullName[0]}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                      {father.fullName}
                    </p>
                    {/* Account Claimed Status Indicator */}
                    {father.accountClaimed && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 font-mono tracking-tighter uppercase">
                    {father.eotcUid ?? "PENDING_ID"}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                No Record Found
              </p>
            </div>
          )}
        </div>

        {/* Decorative Footer */}
        <div className="mt-4 pt-4 border-t border-slate-900">
          <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] text-center">
            Atsede Niseha • Governor Control
          </p>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-500"
        />
      )}
    </>
  );
}
