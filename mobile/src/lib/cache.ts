import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("atsede_offline.db");
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS appointments_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages_cache (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages_cache(channelId, createdAt);
    `);
  }
  return dbInstance;
}

export const offlineCache = {
  // ─── APPOINTMENTS ──────────────────────────────────────────
  async getAppointments<T = any>(): Promise<T[]> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{ data: string }>(
        "SELECT data FROM appointments_cache ORDER BY updatedAt DESC"
      );
      return rows.map((r) => JSON.parse(r.data));
    } catch (e) {
      console.warn("Failed reading cached appointments:", e);
      return [];
    }
  },

  async saveAppointments(appointments: Array<{ id: string; [key: string]: any }>): Promise<void> {
    try {
      const db = await getDb();
      const now = Date.now();
      await db.withTransactionAsync(async () => {
        // Clear old cache and replace with fresh snapshot
        await db.runAsync("DELETE FROM appointments_cache");
        for (const item of appointments) {
          await db.runAsync(
            "INSERT OR REPLACE INTO appointments_cache (id, data, updatedAt) VALUES (?, ?, ?)",
            [item.id, JSON.stringify(item), now]
          );
        }
      });
    } catch (e) {
      console.warn("Failed saving appointments to offline cache:", e);
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
    try {
      const db = await getDb();
      // Keep only the latest 50 messages
      const latest50 = [...messages]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);

      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM messages_cache WHERE channelId = ?", [channelId]);
        for (const msg of latest50) {
          await db.runAsync(
            "INSERT OR REPLACE INTO messages_cache (id, channelId, data, createdAt) VALUES (?, ?, ?, ?)",
            [msg.id, channelId, JSON.stringify(msg), msg.createdAt || Date.now()]
          );
        }
      });
    } catch (e) {
      console.warn("Failed saving messages to offline cache:", e);
    }
  },
};

