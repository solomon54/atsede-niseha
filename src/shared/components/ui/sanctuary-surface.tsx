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
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-white border border-slate-200 shadow-lg rounded-3xl",
        className
      )}
      {...props}>
      {children}
    </div>
  );
});

SanctuarySurface.displayName = "SanctuarySurface";

export { SanctuarySurface };
