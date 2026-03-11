//src/shared/components/ui/sanctuary-surface.tsx
export function SanctuarySurface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
      backdrop-blur-xl
      bg-white/60 dark:bg-white/5
      border border-black/5 dark:border-white/10
      shadow-xl
      rounded-2xl
    ">
      {children}
    </div>
  );
}
