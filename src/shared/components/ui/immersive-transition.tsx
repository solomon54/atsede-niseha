// src/shared/components/ui/immersive-transition.tsx
"use client";

import React from "react";

import { cn } from "@/shared/utils/utils";

interface ImmersiveTransitionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * High-performance, static version of the transition wrapper.
 * Removes framer-motion dependencies to reduce CPU/GPU load.
 */
export function ImmersiveTransition({
  children,
  className,
  ...props
}: ImmersiveTransitionProps) {
  return (
    <div className={cn("flex-1 w-full", className)} {...props}>
      {children}
    </div>
  );
}
