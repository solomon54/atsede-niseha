//src/features/messaging/services/sync.service.ts

/**
 * EOTC Sacred Ledger — Sync Manager
 * ============================================================
 * Ensures zero data loss by reconciling local pending messages
 * with the server once connectivity is restored.
 */

import { db, LocalLedgerMessage } from "../db/ladger-db";

export const syncService = {
  /**
   * Main entry point: Scans and pushes pending messages.
   */
  async syncPendingMessages() {
    // 1. Get all messages that haven't reached the server yet
    const pending = await db.messages
      .where("status")
      .equals("sending")
      .sortBy("createdAt");

    if (pending.length === 0) return;

    console.log(`[SYNC] Found ${pending.length} pending messages. Syncing...`);

    for (const msg of pending) {
      await this.processMessage(msg);
    }
  },

  /**
   * Process an individual message with retry logic.
   */
  async processMessage(msg: LocalLedgerMessage) {
    try {
      // We call our API route (route.ts)
      const response = await fetch("/api/message/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: msg.channelId,
          content: msg.content,
          type: msg.type,
          clientMessageId: msg.clientMessageId, // CRITICAL for Idempotency
          media: msg.media,
          isEncrypted: msg.isEncrypted,
          encryption: msg.encryption,
        }),
      });

      const result = await response.json();

      if (response.ok || result.redundant) {
        // Handshake success! Update the local ledger.
        await db.markAsSent(msg.id);
        console.log(`[SYNC] Successfully synced message: ${msg.id}`);
      } else {
        throw new Error(result.error || "Server rejected message");
      }
    } catch (err) {
      console.error(`[SYNC] Failed to sync ${msg.id}:`, err);
      // We don't mark as error yet, we wait for the next connection window
    }
  },
};
