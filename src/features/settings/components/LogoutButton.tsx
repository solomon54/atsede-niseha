"use client";
// src/features/settings/components/LogoutButton.tsx

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";

import { clearWebAccountCache } from "@/features/messaging/services/clientAccount.service";

/**
 * Profile-page logout.
 *
 * Cached reads/cursors belong to the account that produced them, while the
 * outbox stays account-scoped and is intentionally preserved. The native form
 * remains the fallback when JavaScript is unavailable.
 */
export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (loggingOut) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    setLoggingOut(true);

    const form = e.currentTarget;

    try {
      await clearWebAccountCache();
    } catch (err) {
      console.warn("Logout cleanup failed:", err);
    } finally {
      // Continue with the original server-side logout + redirect.
      form.submit();
    }
  }

  return (
    <form action="/api/auth/logout" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 px-4 py-3
          rounded-2xl border border-red-200 bg-white text-red-600 text-xs
          font-black uppercase tracking-widest hover:bg-red-50 transition-colors
          disabled:opacity-50">
        {loggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4" />
        )}
        {loggingOut ? "በመውጣት ላይ…" : "ወጣ / Logout"}
      </button>
    </form>
  );
}
