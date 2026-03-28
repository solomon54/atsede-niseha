//src/app/manifest.ts

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atsede Niseha - EOTC Sacred Ledger",
    short_name: "Atsede",
    description: "Spiritual lineage and sacred messaging sanctuary.",
    start_url: "/",
    display: "standalone",
    // Matches your 'Off-white Parchment' bg-[#fdfcf6]
    background_color: "#fdfcf6",
    // Matches your 'Deep Slate' text-slate-900 for the status bar
    theme_color: "#0f172a",
    icons: [
      {
        src: "/assets/icons/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable", // Allows Android to circle/square the icon
      },
      {
        src: "/assets/icons/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    // Optional: lock to portrait to maintain the "Sacred Header" layout
    orientation: "portrait",
  };
}
