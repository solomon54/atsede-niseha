// src/app/layout.tsx

import "./globals.css";
import "@/styles/themes.css";

import type { Metadata } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";

import { SanctuaryNavigation } from "@/shared/components/layout/SanctuaryNavigation";
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";

/* ---------- VIEWPORT ---------- */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/* ---------- FONTS ---------- */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const ethiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
});

export const metadata: Metadata = {
  title: "ዐጸደ ንስሐ | Atsede Niseha",
  description: "Digital Logistics for the Ethiopian Orthodox Tewahedo Church",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="am" className="selection:bg-amber-200">
      <body
        className={[
          inter.variable,
          ethiopic.variable,
          "font-sans antialiased text-slate-900",
          "[font-feature-settings:'ss01','cv01','cv02']",
        ].join(" ")}>
        <SanctuaryBackground />

        <ImmersiveTransition>
          {/* 🔥 Main content wrapper with padding for navigation */}
          <main className="md:pl-20 lg:pl-64 pb-16 md:pb-0 min-h-screen">
            {children}
          </main>
        </ImmersiveTransition>

        {/* Navigation only appears after login */}
        <SanctuaryNavigation />
      </body>
    </html>
  );
}
