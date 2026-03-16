// src/features/father/components/TokenSanctuary.tsx

"use client";

import { RefreshCw } from "lucide-react";
import React from "react";

/**
 * TokenSanctuary Props
 * @param fatherEotcId - The Father's Spiritual ID (e.g., EOTC-7654ABCD)
 * @param currentToken - The full interleaved child token (e.g., EOTC-F1C1F2C2...)
 * @param onRegenerate - Callback to trigger the "Covenant Mixer" in the parent form
 */
interface TokenSanctuaryProps {
  fatherEotcId: string;
  currentToken: string;
  onRegenerate: () => void;
}

/**
 * Component: TokenSanctuary
 * Visualizes the ecclesiastical token generated for a spiritual child.
 * Highlights the "Covenant Link" between the Father's ID and the Child's seed.
 */
export function TokenSanctuary({
  fatherEotcId,
  currentToken,
  onRegenerate,
}: TokenSanctuaryProps) {
  /**
   * Logic: The currentToken is formatted as "EOTC-[MIXED_HEX]".
   * We extract the [MIXED_HEX] for high-contrast display.
   */
  const tokenParts = currentToken?.split("-") || [];
  const mixedHex = tokenParts[1] || "############";

  /**
   * For visual clarity, we show the static prefix and the
   * dynamic interleaved payload separately.
   */
  return (
    <div className="bg-slate-900 p-1 md:p-6 rounded-xl md:rounded-3xl text-center relative overflow-hidden shadow-2xl border border-slate-800">
      {/* Decorative Label */}
      <label className="text-[8px] font-black text-amber-500/60 uppercase tracking-widest mb-3 block">
        መንፈሳዊ የቃል ኪዳን ቁልፍ (Covenant Link)
      </label>

      <div className="flex flex-wrap justify-center items-center gap-1 font-mono text-[12px] md:text-xl">
        {/* Fixed Ecclesiastical Prefix */}
        <span className="text-slate-500 font-bold">EOTC—</span>

        {/* The Interleaved Inter-generational Key */}
        <span className="text-amber-400 font-black tracking-[0.2em] drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
          {mixedHex}
        </span>

        {/* Manual Regenerate Action: Triggers the mixing logic in RegisterChildForm */}
        <button
          title="Regenerate Token"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onRegenerate();
          }}
          className="ml-4 p-2 text-amber-500 hover:text-amber-300 hover:rotate-180 transition-all duration-500 active:scale-75">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Instructional Subtext */}
      <p className="mt-3 text-[9px] text-slate-500 font-medium">
        ይህ ቁልፍ በልጁ ስልክ ላይ &quot;መለያ&quot; (Token) ሆኖ የሚያገለግል ሲሆን አባታዊ ማንነትዎን
        ይዟል::
      </p>

      {/* High-End Background Decorative Element */}
      <div className="absolute -right-1 bottom-0 opacity-[0.3] md:opacity-[.5] pointer-events-none transform rotate-12">
        <RefreshCw size={121} className="text-amber-600 " />
      </div>

      {/* Subtle Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-linear-to-r from-transparent via-amber-500/20 to-transparent" />
    </div>
  );
}
