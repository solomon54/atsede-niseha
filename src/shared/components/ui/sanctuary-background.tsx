// src/shared/components/ui/sanctuary-background.tsx
"use client";

export function SanctuaryBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#fdfcf6]">
      {/* Static, soft gradients instead of animated orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/5 blur-[100px]" />
      <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-600/5 blur-[120px]" />

      {/* Lightweight CSS Pattern instead of Grain Image */}
      <div className="absolute inset-0 opacity-[0.03] sanctuary-dots" />
    </div>
  );
}
