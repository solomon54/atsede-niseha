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

export type SQLiteAppointmentAction =
  | "CONFIRM"
  | "DECLINE"
  | "RESCHEDULE"
  | "CANCEL"
  | "COMPLETE";

export interface SQLiteAppointmentOutboxItem {
  operationId: string;
  ownerUid: string;
  appointmentId: string;
  action: SQLiteAppointmentAction;
  expectedVersion: number;
  payload: any;
  status: "QUEUED" | "SENDING" | "FAILED";
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  lastErrorCode?: string;
  needsAttention: number; // 0 | 1
  leaseUntil?: number;
}

export function appointmentSnapshotKey(ownerUid: string): string {
  return `appointments:${ownerUid}`;
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

      -- Account-scoped appointment action queue.
      CREATE TABLE IF NOT EXISTS appointment_outbox (
        operationId TEXT PRIMARY KEY,
        ownerUid TEXT NOT NULL,
        appointmentId TEXT NOT NULL,
        action TEXT NOT NULL,
        expectedVersion INTEGER NOT NULL,
        payload TEXT,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        retryCount INTEGER DEFAULT 0,
        nextRetryAt TEXT,
        lastError TEXT,
        lastErrorCode TEXT,
        needsAttention INTEGER DEFAULT 0,
        leaseUntil INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_appointment_outbox_owner
        ON appointment_outbox(ownerUid, status, createdAt);
      CREATE INDEX IF NOT EXISTS idx_appointment_outbox_appt
        ON appointment_outbox(ownerUid, appointmentId);

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

    // Legacy global appointment snapshot had no account ownership and must
    // never be rendered. Delete it; account-scoped snapshots use `appointments:${uid}`.
    try {
      await dbInstance.runAsync(
        "DELETE FROM query_cache WHERE key = ?",
        ["appointments"]
      );
    } catch {}
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

  // ─── MESSAGE OUTBOX ────────────────────────────────────────
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

  // ─── APPOINTMENT SNAPSHOT & OUTBOX (account-scoped) ─────────
  async getAppointmentSnapshot<T>(ownerUid: string): Promise<T | null> {
    if (!ownerUid) return null;
    return this.getQuery<T>(appointmentSnapshotKey(ownerUid));
  },

  async setAppointmentSnapshot<T>(ownerUid: string, data: T): Promise<void> {
    if (!ownerUid) return;
    return this.setQuery<T>(appointmentSnapshotKey(ownerUid), data);
  },

  async listAppointmentOutbox(
    ownerUid: string
  ): Promise<SQLiteAppointmentOutboxItem[]> {
    if (!ownerUid) return [];
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<any>(
        "SELECT * FROM appointment_outbox WHERE ownerUid = ? ORDER BY createdAt ASC",
        [ownerUid]
      );
      return rows.map((r) => ({
        ...r,
        payload: r.payload ? JSON.parse(r.payload) : undefined,
        needsAttention: Number(r.needsAttention) || 0,
        retryCount: Number(r.retryCount) || 0,
        expectedVersion: Number(r.expectedVersion),
      }));
    } catch (e) {
      console.warn("Failed to list appointment outbox:", e);
      return [];
    }
  },

  async getAppointmentOutboxFor(
    ownerUid: string,
    appointmentId: string
  ): Promise<SQLiteAppointmentOutboxItem | null> {
    if (!ownerUid || !appointmentId) return null;
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<any>(
        "SELECT * FROM appointment_outbox WHERE ownerUid = ? AND appointmentId = ? ORDER BY createdAt ASC",
        [ownerUid, appointmentId]
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        ...r,
        payload: r.payload ? JSON.parse(r.payload) : undefined,
        needsAttention: Number(r.needsAttention) || 0,
        retryCount: Number(r.retryCount) || 0,
        expectedVersion: Number(r.expectedVersion),
      };
    } catch {
      return null;
    }
  },

  async queueAppointmentAction(params: {
    ownerUid: string;
    operationId: string;
    appointmentId: string;
    action: SQLiteAppointmentAction;
    expectedVersion: number;
    payload?: any;
  }): Promise<void> {
    const {
      ownerUid,
      operationId,
      appointmentId,
      action,
      expectedVersion,
      payload,
    } = params;
    if (!ownerUid) throw new Error("No authenticated account.");

    return enqueueWrite(async () => {
      const db = await getDb();
      // Only one unresolved action per appointment per owner.
      const existing = await db.getAllAsync<{ operationId: string; status: string; needsAttention: number }>(
        "SELECT operationId, status, needsAttention FROM appointment_outbox WHERE ownerUid = ? AND appointmentId = ?",
        [ownerUid, appointmentId]
      );
      const blocking = existing.find(
        (r) =>
          r.operationId !== operationId &&
          (r.status === "QUEUED" ||
            r.status === "SENDING" ||
            (r.status === "FAILED" && Number(r.needsAttention) === 1))
      );
      if (blocking) {
        throw new Error("ACTION_ALREADY_QUEUED");
      }

      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO appointment_outbox
          (operationId, ownerUid, appointmentId, action, expectedVersion, payload, status, createdAt, updatedAt, retryCount, nextRetryAt, lastError, lastErrorCode, needsAttention, leaseUntil)
         VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, 0, NULL, NULL, NULL, 0, NULL)`,
        [
          operationId,
          ownerUid,
          appointmentId,
          action,
          expectedVersion,
          payload ? JSON.stringify(payload) : null,
          now,
          now,
        ]
      );
    });
  },

  async updateAppointmentOutbox(
    operationId: string,
    patch: Partial<SQLiteAppointmentOutboxItem>
  ): Promise<void> {
    return enqueueWrite(async () => {
      const db = await getDb();
      const fields: string[] = [];
      const values: any[] = [];
      const set = (col: string, val: any) => {
        fields.push(`${col} = ?`);
        values.push(val);
      };
      if (patch.status !== undefined) set("status", patch.status);
      if (patch.retryCount !== undefined) set("retryCount", patch.retryCount);
      if (patch.nextRetryAt !== undefined) set("nextRetryAt", patch.nextRetryAt ?? null);
      if (patch.lastError !== undefined) set("lastError", patch.lastError ?? null);
      if (patch.lastErrorCode !== undefined)
        set("lastErrorCode", patch.lastErrorCode ?? null);
      if (patch.needsAttention !== undefined)
        set("needsAttention", patch.needsAttention ? 1 : 0);
      if (patch.leaseUntil !== undefined) set("leaseUntil", patch.leaseUntil ?? null);
      if (patch.updatedAt !== undefined) set("updatedAt", patch.updatedAt);
      if (fields.length === 0) return;
      values.push(operationId);
      await db.runAsync(
        `UPDATE appointment_outbox SET ${fields.join(", ")} WHERE operationId = ?`,
        values
      );
    });
  },

  async removeAppointmentOutbox(operationId: string): Promise<void> {
    return enqueueWrite(async () => {
      const db = await getDb();
      await db.runAsync(
        "DELETE FROM appointment_outbox WHERE operationId = ?",
        [operationId]
      );
    });
  },

  async recoverInterruptedAppointmentOutbox(ownerUid: string): Promise<void> {
    if (!ownerUid) return;
    return enqueueWrite(async () => {
      const db = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        "UPDATE appointment_outbox SET status = 'QUEUED', leaseUntil = NULL, nextRetryAt = NULL, updatedAt = ? WHERE ownerUid = ? AND status = 'SENDING'",
        [now, ownerUid]
      );
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
    // Serialize with queued writes so a write already in flight cannot land
    // after the account boundary has cleared cached views.
    await enqueueWrite(async () => {
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
    });
  },
};
