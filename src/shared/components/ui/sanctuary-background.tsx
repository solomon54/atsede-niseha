//src/shared/components/ui/sanctuary-background.tsx
"use client";

export function SanctuaryBackground() {
  return (
    <div className="sanctuary-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Dynamic Animated Orbs */}
      <div className="sanctuary-light" />
      <div className="sanctuary-light-secondary" />

      {/* Moving Grain Overlay for tactile feel */}
      <div className="sanctuary-grain" />

      {/* Subtle interaction layer */}
      <div className="absolute inset-0 bg-white/10 backdrop-soft" />
    </div>
  );
}
