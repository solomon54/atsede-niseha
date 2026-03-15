//src/app/(dashboard)/layout.tsx

import { SanctuaryNavigation } from "@/shared/components/layout/SanctuaryNavigation";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Logic: In a real app, you'd get the role from your Auth Service/Cookie
  const mockRole = "STUDENT";

  return (
    <div className="min-h-screen bg-[#fdfcf6]">
      <SanctuaryBackground />

      {/* The Unified Navigation */}
      <SanctuaryNavigation role={mockRole as any} />

      {/* Main Content Area: Offset for desktop sidebar and mobile bottom bar */}
      <main className="md:pl-64 pb-24 md:pb-8 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 pt-8 md:pt-12">{children}</div>
      </main>
    </div>
  );
}
