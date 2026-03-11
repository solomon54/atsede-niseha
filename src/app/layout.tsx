// src/app/layout.tsx

import "./globals.css";
import "@/styles/themes.css";

import type { Metadata } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";

import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";

/* ---------- FONTS ---------- */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ethiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
});

/* ---------- META ---------- */

export const metadata: Metadata = {
  title: "ዐጸደ ንስሐ | Atsede Niseha",
  description: "Digital Logistics for the Ethiopian Orthodox Tewahedo Church",
};

/* ---------- LAYOUT ---------- */

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
          "font-sans",
          "antialiased",
          "text-slate-900",
          "[font-feature-settings:'ss01','cv01','cv02']",
        ].join(" ")}>
        <SanctuaryBackground />

        <ImmersiveTransition>{children}</ImmersiveTransition>

        {/* Dock */}
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md h-16 bg-white/30 backdrop-blur-2xl border border-white/40 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 flex items-center justify-around px-8">
          <div className="dock-icon">⛪</div>
          <div className="dock-icon">📜</div>
          <div className="dock-icon active">🔐</div>
        </nav>
      </body>
    </html>
  );
}
