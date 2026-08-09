// src/features/notes/db/notes-db.ts
/**
 * LOCAL-ONLY NOTES DATABASE
 * ─────────────────────────────────────────────
 * Zero sync. Zero server. Lives exclusively in IndexedDB.
 * Per the SRS §4.5 — "The Hidden Ledger" policy.
 */
import Dexie, { type Table } from "dexie";

export interface LocalNote {
  id: string;               // client-generated UUID
  userId: string;           // scopes to device owner
  title: string;            // plain text title (not encrypted — only content is)
  encryptedContent: string; // AES-256-GCM ciphertext
  iv: string;               // base64 IV for decryption
  wordCount: number;        // derived at save time (from plain text)
  createdAt: number;        // ms timestamp
  updatedAt: number;        // ms timestamp
}

class NotesDB extends Dexie {
  notes!: Table<LocalNote>;

  constructor() {
    super("AtsedeNiseha_Notes");
    this.version(1).stores({
      notes: "id, userId, updatedAt, [userId+updatedAt]",
    });
  }
}

export const notesDb = new NotesDB();
