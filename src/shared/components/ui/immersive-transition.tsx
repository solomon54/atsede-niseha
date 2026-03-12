// src/shared/components/ui/immersive-transition.tsx
"use client";

export function ImmersiveTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  // We keep the container but remove the motion logic for now
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 pt-8 pb-32">
      {children}
    </div>
  );
}
