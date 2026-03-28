//src/features/messaging/db/ladger-db.ts
/**
 * EOTC Sacred Ledger — Client-Side Database (IndexedDB)
 * ============================================================
 */

import Dexie, { type Table } from "dexie";

import { ChannelRole, Message, MessageID, UID } from "../types/messaging.types";

export interface LocalLedgerMessage extends Message {
  status: "sending" | "sent" | "error";
  errorMessage?: string;
  version: "v1";
  // The local physical file for offline access & zero-cost re-downloads
  localBlob?: Blob;
}

export interface CachedMember {
  id: UID;
  fullName: string;
  role: ChannelRole;
  photoUrl?: string;
  isDiacon?: boolean;
}

export class SacredLedgerDB extends Dexie {
  messages!: Table<LocalLedgerMessage>;
  members!: Table<CachedMember>;

  constructor() {
    super("AtsedeNiseha_Ledger");

    // Version 3: Added localBlob support
    this.version(3).stores({
      messages:
        "id, clientMessageId, channelId, createdAt, status, [channelId+createdAt]",
      members: "id, role",
    });
  }

  // Helper to save a file locally after download
  async saveLocalBlob(id: MessageID, blob: Blob) {
    return this.messages.update(id, { localBlob: blob });
  }

  async markAsSent(id: MessageID) {
    return this.messages.update(id, {
      status: "sent",
      errorMessage: undefined,
    });
  }

  async markAsError(id: MessageID, error: string) {
    return this.messages.update(id, {
      status: "error",
      errorMessage: error,
    });
  }
}

export const db = new SacredLedgerDB();
