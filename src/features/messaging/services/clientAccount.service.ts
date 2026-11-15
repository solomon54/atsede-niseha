//src/features/messaging/services/clientAccount.service.ts

/**
 * Account boundary helpers for the browser client.
 *
 * Cached reads and sync cursors belong to the account that produced them.
 * Outbox operations do NOT belong here: they are scoped by userId and are
 * preserved so pending work is never destroyed on logout or account switch.
 */

import { getPusherClient } from "@/services/pusher";

import { db } from "../db/ladger-db";

interface ClearAccountCacheOptions {
  /**
   * Remove the persisted EOTC identity as well. Logout should clear it;
   * a successful login should keep the new identity that was just stored.
   */
  clearIdentity?: boolean;
}

export async function clearWebAccountCache(
  options: ClearAccountCacheOptions = {}
): Promise<void> {
  if (typeof window === "undefined") return;

  const { clearIdentity = true } = options;

  // Preserve outbox operations (they are account-scoped); drop everything
  // that could be rendered for the previous account.
  await db.clearCachedAccountData().catch((err) => {
    console.warn("[ACCOUNT] Failed clearing cached account data:", err);
  });

  try {
    localStorage.removeItem("sacred_ledger_session");
    if (clearIdentity) {
      localStorage.removeItem("atsede_niseha_uid");
    }

    // Conversation snapshots are written as `sacred_convos_<uid>`.
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("sacred_convos_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn("[ACCOUNT] Failed clearing local storage:", err);
  }

  // Do not leave a socket authenticated as the old account.
  try {
    getPusherClient().disconnect();
  } catch {
    // Pusher may not have been initialised yet.
  }
}
