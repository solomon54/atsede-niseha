//src/shared/components/ui/sanctuary-surface.tsx
export function SanctuarySurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="backdrop-blur-md bg-white/70 border border-white/40 shadow-xl rounded-3xl transition-all">
      {children}
    </div>
  );
}
