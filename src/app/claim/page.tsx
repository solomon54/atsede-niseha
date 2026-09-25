import { Suspense } from "react";
import ClaimClient from "./ClaimClient";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#fdfcf6]">
          <div className="animate-pulse text-amber-700 font-bold uppercase tracking-widest text-xs">
            Loading Secure Gateway...
          </div>
        </div>
      }
    >
      <ClaimClient />
    </Suspense>
  );
}
