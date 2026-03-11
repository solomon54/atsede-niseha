//src/shared/components/ui/immersive-transition.tsx
"use client";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

export function ImmersiveTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
        transition={{
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1], // Custom "Apple-style" quint easing
        }}
        className="flex-1 w-full max-w-5xl mx-auto px-4 pt-8 pb-32">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
