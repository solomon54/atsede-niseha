// src/shared/components/ui/immersive-transition.tsx
"use client";

import { HTMLMotionProps, motion } from "framer-motion";

import { cn } from "@/shared/utils/utils";

/**
 * Production-grade Transition Wrapper
 * Extends HTMLMotionProps to support all motion props (className, initial, animate, etc.)
 */
interface ImmersiveTransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function ImmersiveTransition({
  children,
  className,
  ...props
}: ImmersiveTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
      }}
      className={cn(
        "flex-1 w-full max-w-7xl mx-auto px-0 pt-0 pb-12",
        className
      )}
      {...props}>
      {children}
    </motion.div>
  );
}
