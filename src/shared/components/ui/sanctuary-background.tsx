// src/shared/components/ui/sanctuary-background.tsx
"use client";
import { memo } from "react";

export const SanctuaryBackground = memo(function SanctuaryBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#fdfcf6]" aria-hidden="true">
      <div className="absolute inset-0 bg-linear-to-br from-blue-50/20 via-transparent to-amber-50/20" />
    </div>
  );
});
