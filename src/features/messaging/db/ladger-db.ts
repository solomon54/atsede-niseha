//src/features/messaging/db/ladger-db.ts
/**
 * EOTC Sacred Ledger — Client-Side Database (IndexedDB via Dexie)
 * ============================================================
 * Primary source for offline-first rendering and zero-cost re-rendering.
 */

import Dexie, { type Table } from "dexie";

import type {
  AppointmentChildDirectoryEntry,
  AppointmentOutboxOperation,
  AppointmentRecord,
} from "@/shared/domain/appointments";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media?: any;
    isEncrypted?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Account-scoped appointment cache row.
 *
 * The cache only ever holds server-confirmed records. Optimistic/pending work
 * lives in `appointmentOutbox` so the UI can never present an unconfirmed
 * action as if the server had accepted it.
 */
export interface LocalAppointmentCache {
  /** `${ownerUid}__${appointmentId}` — the primary key. */
  cacheKey: string;
  ownerUid: string;
  appointmentId: string;

  /** Denormalized indexes for account-scoped queries. */
  childUid: string;
  status: AppointmentRecord["status"];
  scheduledAt: string;
  updatedAt: string;

  appointment: AppointmentRecord;
  cachedAt: string;
}

/**
 * Durable, account-scoped appointment action queue row.
 *
 * Extends the shared domain operation with local-only bookkeeping used for
 * crash recovery. `leaseUntil` prevents two tabs from draining the same
 * operation while a request is in flight.
 */
export interface LocalAppointmentOutboxRow extends AppointmentOutboxOperation {
  /** Epoch milliseconds; while in the future another tab owns the claim. */
  leaseUntil?: number;
  updatedAt: string;
}

/** Stored snapshot of the child directory, keyed per account. */
export interface LocalAppointmentChildDirectorySnapshot {
  key: string; // `appointments-children-${ownerUid}`
  ownerUid: string;
  children: AppointmentChildDirectoryEntry[];
  cachedAt: string;
}

export interface OutboxOperation {
  operationId: string;
  userId?: string; // Account ownership
  channelId: string;
  type: "SEND_MESSAGE" | "EDIT_MESSAGE" | "DELETE_MESSAGE" | "MARK_READ";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  status: "pending" | "sending" | "failed";
  retryCount: number;
  createdAt: number;
  errorMessage?: string;
}

export interface SyncMeta {
  key: string; // e.g. "channel_{channelId}", "conversations", "appointments-children-{uid}"
  lastSyncAt: number;
  afterId?: string; // Document ID tiebreaker for identical timestamps
  /** Optional opaque snapshot for account-scoped records (e.g. child directory). */
  data?: unknown;
}

export class SacredLedgerDB extends Dexie {
  messages!: Table<LocalLedgerMessage>;
  members!: Table<CachedMember>;
  conversations!: Table<LocalConversation>;
  appointmentCache!: Table<LocalAppointmentCache>;
  appointmentOutbox!: Table<LocalAppointmentOutboxRow>;
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

    // Version 5: Account Isolation & Tiebreaker Index
    this.version(5)
      .stores({
        messages:
          "id, clientMessageId, channelId, createdAt, updatedAt, status, [channelId+createdAt], [channelId+updatedAt]",
        members: "id, role",
        conversations: "id, role, updatedAt, lastMessageAt",
        appointments: "id, familyId, scheduledAt, updatedAt, status",
        outbox:
          "operationId, userId, channelId, type, status, createdAt, [userId+status]",
        syncMeta: "key",
      })
      .upgrade(async (tx) => {
        // Existing installations may have outbox rows created before account
        // ownership existed. Attach them to their sender when that evidence
        // exists; otherwise quarantine (never delete) so they can never run
        // under a different account's session.
        const table = tx.table<OutboxOperation, string>("outbox");
        const legacy = await table.filter((op) => !op.userId).toArray();

        for (const op of legacy) {
          const owner =
            typeof op.payload?.senderId === "string"
              ? op.payload.senderId
              : undefined;

          if (owner) {
            await table.update(op.operationId, { userId: owner });
          } else {
            await table.update(op.operationId, {
              status: "failed",
              errorMessage:
                "Legacy outbox operation has no account owner; preserved but not executed.",
            });
          }
        }
      });

    // Version 6: Account-scoped appointments.
    //
    // The legacy global `appointments` store is intentionally dropped: it had
    // no account ownership and could leak one family member's appointments to
    // another signed-in account on a shared device. The new cache and outbox
    // are both keyed by `ownerUid`, so account switching needs no cleanup step.
    this.version(6).stores({
      messages:
        "id, clientMessageId, channelId, createdAt, updatedAt, status, [channelId+createdAt], [channelId+updatedAt]",
      members: "id, role",
      conversations: "id, role, updatedAt, lastMessageAt",
      appointmentCache:
        "cacheKey, ownerUid, appointmentId, childUid, status, scheduledAt, updatedAt, [ownerUid+appointmentId], [ownerUid+childUid]",
      appointmentOutbox:
        "operationId, ownerUid, appointmentId, status, createdAt, [ownerUid+status]",
      outbox:
        "operationId, userId, channelId, type, status, createdAt, [userId+status]",
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
   * Account Isolation: Purge cached messages, conversations, and appointments on logout,
   * while PRESERVING unsent outbox operations (scoped by userId/ownerUid) so pending work is never destroyed.
   */
  async clearCachedAccountData() {
    return this.transaction(
      "rw",
      [
        this.messages,
        this.members,
        this.conversations,
        this.appointmentCache,
        this.syncMeta,
      ],
      async () => {
        await this.messages.clear();
        await this.members.clear();
        await this.conversations.clear();
        await this.appointmentCache.clear();
        await this.syncMeta.clear();
      }
    );
  }

  async getPendingOutboxCount(userId?: string): Promise<number> {
    if (!userId) return 0;

    return this.outbox
      .where("userId")
      .equals(userId)
      .and((op) => op.status === "pending")
      .count();
  }

  /** Pending appointment actions owned by this account, across all appointments. */
  async getPendingAppointmentOutboxCount(ownerUid?: string): Promise<number> {
    if (!ownerUid) return 0;

    return this.appointmentOutbox
      .where("[ownerUid+status]")
      .equals([ownerUid, "QUEUED"])
      .count();
  }

  /**
   * Runtime safety net for databases that were already opened at schema v5
   * before ownership backfill ran (e.g. an interrupted earlier release).
   * Unowned rows are never executed; they are preserved and quarantined.
   */
  async migrateLegacyOutboxOwnership(): Promise<void> {
    const legacy = await this.outbox.filter((op) => !op.userId).toArray();
    if (legacy.length === 0) return;

    await this.transaction("rw", this.outbox, async () => {
      for (const op of legacy) {
        const owner =
          typeof op.payload?.senderId === "string"
            ? op.payload.senderId
            : undefined;

        if (owner) {
          await this.outbox.update(op.operationId, { userId: owner });
        } else {
          await this.outbox.update(op.operationId, {
            status: "failed",
            errorMessage:
              "Legacy outbox operation has no account owner; preserved but not executed.",
          });
        }
      }
    });
  }

  /**
   * Complete Purge: Deletes all stores including outbox.
   */
  async clearAll() {
    return this.transaction(
      "rw",
      [
        this.messages,
        this.members,
        this.conversations,
        this.appointmentCache,
        this.appointmentOutbox,
        this.outbox,
        this.syncMeta,
      ],
      async () => {
        await this.messages.clear();
        await this.members.clear();
        await this.conversations.clear();
        await this.appointmentCache.clear();
        await this.appointmentOutbox.clear();
        await this.outbox.clear();
        await this.syncMeta.clear();
      }
    );
  }
}

export const db = new SacredLedgerDB();
