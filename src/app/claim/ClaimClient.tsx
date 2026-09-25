"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ClaimClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("atsede_niseha_uid", token.toUpperCase());
    }
    // Redirect to the Unified Gateway (home page) which handles localStorage auto-login/claim
    router.replace("/");
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fdfcf6]">
      <div className="animate-pulse text-amber-700 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
        Redirecting to Sanctuary Gateway...
      </div>
    </div>
  );
}
