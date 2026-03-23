import { openDB, DBSchema } from "idb";

const DB_NAME = "hinsete_seb_db";
const DB_VERSION = 2;

interface AppDB extends DBSchema {
  users: {
    key: string;
    value: any;
  };
  notes: {
    key: string;
    value: any;
    indexes: {
      chapterId: string;
      syncStatus: string;
      userId: string;
    };
  };
  progress: {
    key: [string, string]; // [userId, chapterId]
    value: any;
    indexes: {
      userId: string;
      syncStatus: string;
    };
  };
  content: {
    key: string;
    value: any;
  };
}

export async function getDB() {
  return openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ───────── USERS ─────────
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "id" });
      }

      // ───────── NOTES ─────────
      if (!db.objectStoreNames.contains("notes")) {
        const noteStore = db.createObjectStore("notes", {
          keyPath: "id",
        });

        noteStore.createIndex("chapterId", "chapterId");
        noteStore.createIndex("syncStatus", "syncStatus");
        noteStore.createIndex("userId", "userId");
      }

      // ───────── PROGRESS ─────────
      if (!db.objectStoreNames.contains("progress")) {
        const progressStore = db.createObjectStore("progress", {
          keyPath: ["userId", "chapterId"],
        });

        progressStore.createIndex("userId", "userId");
        progressStore.createIndex("syncStatus", "syncStatus");
      }

      // ───────── CONTENT ─────────
      if (!db.objectStoreNames.contains("content")) {
        db.createObjectStore("content", {
          keyPath: "id",
        });
      }
    },
  });
}
