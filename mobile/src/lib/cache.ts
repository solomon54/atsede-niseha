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
        lastSyncAt INTEGER NOT NULL
      );
    `);
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

  // ─── OUTBOX ────────────────────────────────────────────────
  async queueOutbox(
    channelId: string,
    type: SQLiteOutboxItem["type"],
    payload: any
  ): Promise<string> {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return enqueueWrite(async () => {
      try {
        const db = await getDb();
        await db.runAsync(
          "INSERT OR REPLACE INTO outbox (operationId, channelId, type, payload, status, retryCount, createdAt) VALUES (?, ?, ?, ?, 'PENDING', 0, ?)",
          [operationId, channelId, type, JSON.stringify(payload), Date.now()]
        );
        return operationId;
      } catch (e) {
        console.warn("Failed to queue outbox item:", e);
        return operationId;
      }
    });
  },

  async getPendingOutbox(): Promise<SQLiteOutboxItem[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        operationId: string;
        channelId: string;
        type: string;
        payload: string;
        status: string;
        retryCount: number;
        createdAt: number;
      }>("SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY createdAt ASC");

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
  async getSyncCursor(key: string): Promise<number> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ lastSyncAt: number }>(
        "SELECT lastSyncAt FROM sync_meta WHERE key = ?",
        [key]
      );
      return row?.lastSyncAt || 0;
    } catch {
      return 0;
    }
  },

  async setSyncCursor(key: string, timestamp: number): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        "INSERT OR REPLACE INTO sync_meta (key, lastSyncAt) VALUES (?, ?)",
        [key, timestamp]
      );
    } catch (e) {
      console.warn("Failed saving sync cursor:", e);
    }
  },

  // ─── PRIVACY & ACCOUNT ISOLATION ────────────────────────────
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      await db.execAsync(`
        DELETE FROM query_cache;
        DELETE FROM messages_cache;
        DELETE FROM outbox;
        DELETE FROM sync_meta;
      `);
    } catch (e) {
      console.warn("Failed clearing offline cache:", e);
    }
  },
};
