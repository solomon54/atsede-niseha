//src/features/messaging/db/ladger-db.ts
/**
 * EOTC Sacred Ledger — Client-Side Database (IndexedDB via Dexie)
 * ============================================================
 * Primary source for offline-first rendering and zero-cost re-rendering.
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

export interface LocalConversation {
  id: string; // channelId
  role: "DIRECT" | "COMMON_HOUSE";
  title?: string;
  fullName?: string;
  photoUrl?: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: number;
    senderId: string;
    type?: string;
    media?: any;
    isEncrypted?: boolean;
    callDetails?: any;
  } | null;
  lastMessageAt?: number;
  unreadCount?: number;
  members?: Array<{
    userId: string;
    fullName?: string;
    role?: string;
    photoUrl?: string;
  }>;
  updatedAt: number;
}

export interface LocalAppointment {
  id: string;
  familyId: string;
  fatherUid: string;
  fatherName?: string;
  childUid: string;
  childEotcUid?: string;
  childName?: string;
  type: "NISEHA" | "COUNSELING";
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  location?: string;
  message?: string;
  logisticsNote?: string;
  direction?: string;
  createdBy?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxOperation {
  operationId: string;
  channelId: string;
  type: "SEND_MESSAGE" | "EDIT_MESSAGE" | "DELETE_MESSAGE" | "MARK_READ";
  payload: any;
  status: "pending" | "sending" | "failed";
  retryCount: number;
  createdAt: number;
  errorMessage?: string;
}

export interface SyncMeta {
  key: string; // e.g. "channel_{channelId}" or "conversations" or "appointments"
  lastSyncAt: number;
}

export class SacredLedgerDB extends Dexie {
  messages!: Table<LocalLedgerMessage>;
  members!: Table<CachedMember>;
  conversations!: Table<LocalConversation>;
  appointments!: Table<LocalAppointment>;
  outbox!: Table<OutboxOperation>;
  syncMeta!: Table<SyncMeta>;

  constructor() {
    super("AtsedeNiseha_Ledger");

    // Version 3 legacy stores
    this.version(3).stores({
      messages:
        "id, clientMessageId, channelId, createdAt, status, [channelId+createdAt]",
      members: "id, role",
    });

    // Version 4: Complete Offline-First Schema
    this.version(4).stores({
      messages:
        "id, clientMessageId, channelId, createdAt, updatedAt, status, [channelId+createdAt], [channelId+updatedAt]",
      members: "id, role",
      conversations: "id, role, updatedAt, lastMessageAt",
      appointments: "id, familyId, scheduledAt, updatedAt, status",
      outbox: "operationId, channelId, type, status, createdAt",
      syncMeta: "key",
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

  /**
   * Account Isolation: Purge all local data on logout or account switch.
   */
  async clearAll() {
    return this.transaction(
      "rw",
      [
        this.messages,
        this.members,
        this.conversations,
        this.appointments,
        this.outbox,
        this.syncMeta,
      ],
      async () => {
        await this.messages.clear();
        await this.members.clear();
        await this.conversations.clear();
        await this.appointments.clear();
        await this.outbox.clear();
        await this.syncMeta.clear();
      }
    );
  }
}

export const db = new SacredLedgerDB();
