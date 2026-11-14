import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Sequential transaction mutex.
 * SQLite is strictly single-threaded per connection. Overlapping calls to
 * `withTransactionAsync` (e.g. rapid chat polling or simultaneous cache writes)
 * will fail with "cannot start a transaction within a transaction".
 * Enqueuing writes guarantees one transaction finishes before the next begins.
 */
function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.then(
    () => {},
    () => {}
  );
  return next;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("atsede_offline.db");
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      -- Generic snapshot store for list responses (appointments, conversations).
      CREATE TABLE IF NOT EXISTS query_cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      -- Per-message rows keep ordering cheap and let us trim to the last 50.
      CREATE TABLE IF NOT EXISTS messages_cache (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages_cache(channelId, createdAt);
      -- Superseded by query_cache; dropped so upgraded installs don't keep a
      -- second copy of pastoral appointment data around.
      DROP TABLE IF EXISTS appointments_cache;
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

  // ─── MESSAGES (Last 50 per channel) ───────────────────────
  async getMessages<T = any>(channelId: string): Promise<T[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{ data: string }>(
        "SELECT data FROM messages_cache WHERE channelId = ? ORDER BY createdAt ASC",
        [channelId]
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
        // Keep only the latest 50 messages
        const latest50 = [...messages]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50);

        await db.withTransactionAsync(async () => {
          await db.runAsync("DELETE FROM messages_cache WHERE channelId = ?", [
            channelId,
          ]);
          for (const msg of latest50) {
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

  // ─── PRIVACY ───────────────────────────────────────────────
  /**
   * Wipe every cached snapshot. Called on logout and when a session is
   * rejected, so a shared device cannot show one family's pastoral data to
   * the next person who signs in.
   */
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      await db.execAsync(
        "DELETE FROM query_cache; DELETE FROM messages_cache;"
      );
    } catch (e) {
      console.warn("Failed clearing offline cache:", e);
    }
  },
};
