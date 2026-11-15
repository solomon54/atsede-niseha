import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Sequential transaction mutex.
 * SQLite is strictly single-threaded per connection.
 */
function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.then(
    () => {},
    () => {}
  );
  return next;
}

export interface SQLiteOutboxItem {
  operationId: string;
  userId?: string;
  channelId: string;
  type: "SEND_MESSAGE" | "EDIT_MESSAGE" | "DELETE_MESSAGE" | "MARK_READ";
  payload: any;
  status: "PENDING" | "SENDING" | "FAILED";
  retryCount: number;
  createdAt: number;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("atsede_offline.db");
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;

      -- Generic snapshot store for list responses (appointments, conversations)
      CREATE TABLE IF NOT EXISTS query_cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      -- Individual messages table
      CREATE TABLE IF NOT EXISTS messages_cache (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages_cache(channelId, createdAt);

      -- Persistent Outbox table for offline actions
      CREATE TABLE IF NOT EXISTS outbox (
        operationId TEXT PRIMARY KEY,
        userId TEXT,
        channelId TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        retryCount INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, createdAt);

      -- Sync metadata table for cursors
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        lastSyncAt INTEGER NOT NULL,
        afterId TEXT
      );
    `);

    // Migrations for existing local databases. Index creation for the new
    // column must happen after ALTER TABLE, never before it.
    try {
      await dbInstance.execAsync("ALTER TABLE outbox ADD COLUMN userId TEXT;");
    } catch {}
    try {
      await dbInstance.execAsync("ALTER TABLE sync_meta ADD COLUMN afterId TEXT;");
    } catch {}

    try {
      await dbInstance.execAsync(
        "CREATE INDEX IF NOT EXISTS idx_outbox_user ON outbox(userId, status, createdAt);"
      );
    } catch {}

    // Backfill ownership for outbox rows written before the column existed.
    // Rows with no recoverable owner are preserved but quarantined so they can
    // never be replayed under a different account.
    try {
      const unowned = await dbInstance.getAllAsync<{
        operationId: string;
        payload: string;
      }>("SELECT operationId, payload FROM outbox WHERE userId IS NULL");

      for (const row of unowned) {
        let owner: string | undefined;
        try {
          const payload = JSON.parse(row.payload);
          if (typeof payload?.senderId === "string") {
            owner = payload.senderId;
          }
        } catch {}

        if (owner) {
          await dbInstance.runAsync(
            "UPDATE outbox SET userId = ? WHERE operationId = ?",
            [owner, row.operationId]
          );
        } else {
          await dbInstance.runAsync(
            "UPDATE outbox SET status = 'FAILED' WHERE operationId = ?",
            [row.operationId]
          );
        }
      }
    } catch (e) {
      console.warn("Failed migrating outbox ownership:", e);
    }
  }
  return dbInstance;
}

export const offlineCache = {
  // ─── GENERIC SNAPSHOTS ─────────────────────────────────────
  async getQuery<T>(key: string): Promise<T | null> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ data: string }>(
        "SELECT data FROM query_cache WHERE key = ?",
        [key]
      );
      return row ? (JSON.parse(row.data) as T) : null;
    } catch (e) {
      console.warn(`Failed reading cached "${key}":`, e);
      return null;
    }
  },

  async setQuery<T>(key: string, data: T): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        "INSERT OR REPLACE INTO query_cache (key, data, updatedAt) VALUES (?, ?, ?)",
        [key, JSON.stringify(data), Date.now()]
      );
    } catch (e) {
      console.warn(`Failed saving cached "${key}":`, e);
    }
  },

  // ─── MESSAGES ──────────────────────────────────────────────
  async getMessages<T = any>(channelId: string, limit = 50): Promise<T[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{ data: string }>(
        "SELECT data FROM messages_cache WHERE channelId = ? ORDER BY createdAt ASC LIMIT ?",
        [channelId, limit]
      );
      return rows.map((r) => JSON.parse(r.data));
    } catch (e) {
      console.warn("Failed reading cached messages for channel:", channelId, e);
      return [];
    }
  },

  async saveMessages(
    channelId: string,
    messages: Array<{ id: string; createdAt: number; [key: string]: any }>
  ): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.withTransactionAsync(async () => {
          for (const msg of messages) {
            await db.runAsync(
              "INSERT OR REPLACE INTO messages_cache (id, channelId, data, createdAt) VALUES (?, ?, ?, ?)",
              [
                msg.id,
                channelId,
                JSON.stringify(msg),
                msg.createdAt || Date.now(),
              ]
            );
          }
        });
      } catch (e) {
        console.warn("Failed saving messages to offline cache:", e);
      }
    });
  },

  /**
   * Strict variant used by delta sync. Rejects on failure so the caller can
   * avoid advancing the sync cursor past writes that did not land.
   */
  async saveMessagesStrict(
    channelId: string,
    messages: Array<{ id: string; createdAt: number; [key: string]: any }>
  ): Promise<void> {
    return enqueueWrite(async () => {
      const db = await getDb();
      await db.withTransactionAsync(async () => {
        for (const msg of messages) {
          await db.runAsync(
            "INSERT OR REPLACE INTO messages_cache (id, channelId, data, createdAt) VALUES (?, ?, ?, ?)",
            [
              msg.id,
              channelId,
              JSON.stringify(msg),
              msg.createdAt || Date.now(),
            ]
          );
        }
      });
    });
  },

  async updateMessage(
    channelId: string,
    messageId: string,
    updater: (prev: any) => any
  ): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        const row = await db.getFirstAsync<{ data: string }>(
          "SELECT data FROM messages_cache WHERE id = ?",
          [messageId]
        );
        if (row) {
          const current = JSON.parse(row.data);
          const updated = updater(current);
          await db.runAsync(
            "UPDATE messages_cache SET data = ? WHERE id = ?",
            [JSON.stringify(updated), messageId]
          );
        }
      } catch (e) {
        console.warn("Failed updating message in offline cache:", e);
      }
    });
  },

  async deleteMessage(messageId: string): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync("DELETE FROM messages_cache WHERE id = ?", [messageId]);
      } catch (e) {
        console.warn("Failed deleting message in offline cache:", e);
      }
    });
  },

  /**
   * Replace the optimistic client ID with the server ID after a successful
   * send. The SQLite primary key cannot be edited in place, so this moves the
   * row instead. If a server row already exists (for example the realtime
   * event arrived first), keep that authoritative row and drop the optimistic
   * duplicate.
   */
  async replaceMessageId(
    channelId: string,
    oldId: string,
    newId: string
  ): Promise<void> {
    if (!oldId || !newId || oldId === newId) return;

    return enqueueWrite(async () => {
      const db = await getDb();
      await db.withTransactionAsync(async () => {
        const oldRow = await db.getFirstAsync<{ data: string }>(
          "SELECT data FROM messages_cache WHERE id = ?",
          [oldId]
        );
        if (!oldRow) return;

        const existingServerRow = await db.getFirstAsync<{ id: string }>(
          "SELECT id FROM messages_cache WHERE id = ?",
          [newId]
        );

        if (existingServerRow) {
          await db.runAsync("DELETE FROM messages_cache WHERE id = ?", [oldId]);
          return;
        }

        const current = JSON.parse(oldRow.data);
        await db.runAsync("DELETE FROM messages_cache WHERE id = ?", [oldId]);
        await db.runAsync(
          "INSERT OR REPLACE INTO messages_cache (id, channelId, data, createdAt) VALUES (?, ?, ?, ?)",
          [
            newId,
            channelId,
            JSON.stringify({
              ...current,
              id: newId,
              status: "SENT",
            }),
            current.createdAt || Date.now(),
          ]
        );
      });
    });
  },

  /** Strict variant of updateMessage used by delta sync. */
  async updateMessageStrict(
    channelId: string,
    messageId: string,
    updater: (prev: any) => any
  ): Promise<void> {
    return enqueueWrite(async () => {
      const db = await getDb();
      const row = await db.getFirstAsync<{ data: string }>(
        "SELECT data FROM messages_cache WHERE id = ?",
        [messageId]
      );
      if (!row) return;

      const current = JSON.parse(row.data);
      const updated = updater(current);
      await db.runAsync("UPDATE messages_cache SET data = ? WHERE id = ?", [
        JSON.stringify(updated),
        messageId,
      ]);
    });
  },

  // ─── OUTBOX ────────────────────────────────────────────────
  async queueOutbox(
    channelId: string,
    type: SQLiteOutboxItem["type"],
    payload: any,
    userId?: string
  ): Promise<string> {
    // An operation with no owner can never be safely replayed later.
    if (!userId) {
      throw new Error(
        "Cannot queue an outbox operation without an authenticated account."
      );
    }

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync(
          "INSERT OR REPLACE INTO outbox (operationId, userId, channelId, type, payload, status, retryCount, createdAt) VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?)",
          [operationId, userId, channelId, type, JSON.stringify(payload), Date.now()]
        );
        return operationId;
      } catch (e) {
        console.warn("Failed to queue outbox item:", e);
        throw e;
      }
    });
  },

  async updateOutboxPayload(operationId: string, payload: any): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync(
          "UPDATE outbox SET payload = ? WHERE operationId = ?",
          [JSON.stringify(payload), operationId]
        );
      } catch (e) {
        console.warn("Failed updating outbox payload:", e);
      }
    });
  },

  async getPendingOutbox(userId?: string): Promise<SQLiteOutboxItem[]> {
    // Never return an unfiltered queue: that would allow cross-account replay.
    if (!userId) return [];

    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        operationId: string;
        userId?: string;
        channelId: string;
        type: string;
        payload: string;
        status: string;
        retryCount: number;
        createdAt: number;
      }>(
        "SELECT * FROM outbox WHERE userId = ? AND status = 'PENDING' ORDER BY createdAt ASC",
        [userId]
      );

      return rows.map((r) => ({
        ...r,
        type: r.type as SQLiteOutboxItem["type"],
        status: r.status as SQLiteOutboxItem["status"],
        payload: JSON.parse(r.payload),
      }));
    } catch (e) {
      console.warn("Failed to get pending outbox items:", e);
      return [];
    }
  },

  async getPendingOutboxCount(userId?: string): Promise<number> {
    if (!userId) return 0;

    try {
      const db = await getDb();
      const res = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM outbox WHERE userId = ? AND status = 'PENDING'",
        [userId]
      );
      return res?.count || 0;
    } catch {
      return 0;
    }
  },

  async removeOutbox(operationId: string): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync("DELETE FROM outbox WHERE operationId = ?", [operationId]);
      } catch (e) {
        console.warn("Failed removing outbox item:", e);
      }
    });
  },

  async markOutboxFailed(operationId: string): Promise<void> {
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync(
          "UPDATE outbox SET status = 'FAILED', retryCount = retryCount + 1 WHERE operationId = ?",
          [operationId]
        );
      } catch (e) {
        console.warn("Failed marking outbox item failed:", e);
      }
    });
  },

  // ─── SYNC CURSORS ──────────────────────────────────────────
  async getSyncCursor(
    key: string
  ): Promise<{ lastSyncAt: number; afterId?: string }> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{
        lastSyncAt: number;
        afterId?: string;
      }>("SELECT lastSyncAt, afterId FROM sync_meta WHERE key = ?", [key]);
      return {
        lastSyncAt: row?.lastSyncAt || 0,
        afterId: row?.afterId || undefined,
      };
    } catch {
      return { lastSyncAt: 0 };
    }
  },

  async setSyncCursor(
    key: string,
    timestamp: number,
    afterId?: string
  ): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        "INSERT OR REPLACE INTO sync_meta (key, lastSyncAt, afterId) VALUES (?, ?, ?)",
        [key, timestamp, afterId || null]
      );
    } catch (e) {
      console.warn("Failed saving sync cursor:", e);
    }
  },

  /** Strict variant used by delta sync: the caller must know if commit failed. */
  async setSyncCursorStrict(
    key: string,
    timestamp: number,
    afterId?: string
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO sync_meta (key, lastSyncAt, afterId) VALUES (?, ?, ?)",
      [key, timestamp, afterId || null]
    );
  },

  // ─── PRIVACY & ACCOUNT ISOLATION ────────────────────────────
  /**
   * Clears cached views and sync metadata on logout.
   * PRESERVES outbox operations (scoped by userId) so pending offline work is never destroyed.
   */
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      await db.execAsync(`
        DELETE FROM query_cache;
        DELETE FROM messages_cache;
        DELETE FROM sync_meta;
      `);
    } catch (e) {
      console.warn("Failed clearing offline cache:", e);
    }
  },
};
