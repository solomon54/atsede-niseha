// src/shared/components/ui/sanctuary-surface.tsx
import * as React from "react";

import { cn } from "@/shared/utils/utils";
export interface SanctuarySurfaceProps
  extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}
const SanctuarySurface = React.forwardRef<
  HTMLDivElement,
  SanctuarySurfaceProps
>(({ className, children, hoverable = false, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-white/90 border border-white/60 shadow-2xl will-change-transform",
        "rounded-3xl transition-all duration-300 ease-out",
        hoverable && "hover:bg-white/95 hover:shadow-black/[0.05]",
        className
      )}
      {...props}>
      {children}
    </div>
  );
});

SanctuarySurface.displayName = "SanctuarySurface";

export { SanctuarySurface };
