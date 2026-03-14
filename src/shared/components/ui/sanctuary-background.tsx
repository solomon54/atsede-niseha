// src/shared/components/ui/sanctuary-background.tsx
"use client";

import { memo } from "react";

export const SanctuaryBackground = memo(function SanctuaryBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#fdfcf6] select-none"
      aria-hidden="true">
      {/*  transform-gpu and opacity optimization */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/3 blur-[80px] transform-gpu will-change-transform" />
      <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-600/3 blur-[100px] transform-gpu will-change-transform" />

      <div className="absolute inset-0 opacity-[0.02] sanctuary-dots" />

      {/* Static gradient is much cheaper than a vignette filter */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-white/60" />
    </div>
  );
});
