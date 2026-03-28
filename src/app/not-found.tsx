//src/app/not-found.tsx

"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}>
        <SanctuarySurface className="max-w-md text-center p-12 border-double border-4 border-amber-900/20">
          <span className="text-6xl mb-6 block">፬፻፬</span>

          <h1 className="text-2xl font-ethiopic font-bold text-slate-900 mb-4">
            የጠፋ ገጽ <br />
            <span className="text-lg font-sans font-medium text-slate-600">
              Page Not Found
            </span>
          </h1>

          <p className="text-slate-500 font-ethiopic mb-8 leading-relaxed">
            ይህ መንገድ ወደ ፈለጉት መቅደስ አይወስድም። <br />
            <span className="text-sm font-sans italic">
              This path does not lead to the requested sanctuary.
            </span>
          </p>

          <Link
            href="/"
            className="inline-block px-8 py-3 bg-slate-900 text-amber-50 rounded-full hover:bg-slate-800 transition-colors duration-300 font-medium">
            ወደ ዋናው መግቢያ (Return Home)
          </Link>
        </SanctuarySurface>
      </motion.div>
    </div>
  );
}
