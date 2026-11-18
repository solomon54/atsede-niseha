// src/features/appointments/services/appointmentOfflineService.ts
/**
 * Account-scoped appointment offline layer.
 *
 * Design rules:
 * - The cache stores only server-confirmed records. Optimistic work lives in
 *   the outbox, so the UI can never present an unconfirmed action as accepted.
 * - Every row is keyed by `ownerUid`. A shared device never reads another
 *   account's appointments, even if logout cleanup did not run.
 * - Each queued action carries a client `operationId` and `expectedVersion`.
 *   The server is the only authority; a 409 is surfaced, never auto-replayed.
 * - Draining uses a short lease so a crashed tab does not block the queue
 *   forever, while a live tab cannot double-submit the same operation.
 */

import {
  db,
  type LocalAppointmentChildDirectorySnapshot,
  type LocalAppointmentOutboxRow,
} from "@/features/messaging/db/ladger-db";
import {
  type AppointmentAction,
  type AppointmentActionPayload,
  type AppointmentActionResponse,
  type AppointmentChildDirectoryEntry,
  type AppointmentRecord,
  isAppointmentParty,
  normalizeAppointment,
} from "@/shared/domain/appointments";

const LEASE_MS = 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

const interruptedResetOwners = new Set<string>();

export class AppointmentOfflineError extends Error {
  constructor(
    message: string,
    public code:
      | "NO_ACCOUNT"
      | "ACTION_ALREADY_QUEUED"
      | "OPERATION_MISMATCH"
      | "NOT_QUEUED"
      | "SENDING"
  ) {
    super(message);
    this.name = "AppointmentOfflineError";
  }
}

function cacheKey(ownerUid: string, appointmentId: string): string {
  return `${ownerUid}__${appointmentId}`;
}

function childrenKey(ownerUid: string): string {
  return `appointments-children-${ownerUid}`;
}

function outboxEventName(ownerUid: string): string {
  return `appointment-outbox-changed:${ownerUid}`;
}

function emitOutboxChanged(ownerUid: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(outboxEventName(ownerUid)));
}

/** Subscribe to queue changes for one account. Returns an unsubscribe hook. */
export function onAppointmentOutboxChanged(
  ownerUid: string,
  listener: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const eventName = outboxEventName(ownerUid);
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

function newOperationId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `apt_${cryptoObj.randomUUID()}`;
  }
  return `apt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Upsert one server-confirmed record, ignoring an out-of-order older version.
 * Records where the account is not a party are refused as a defence in depth
 * against cross-account/cross-sibling leakage.
 */
async function upsertConfirmedRecord(
  ownerUid: string,
  incoming: AppointmentRecord,
  cachedAt: string
): Promise<boolean> {
  const record =
    typeof incoming.identityConsistent === "boolean"
      ? incoming
      : normalizeAppointment(incoming);

  if (!ownerUid || !isAppointmentParty(record, ownerUid)) return false;

  const key = cacheKey(ownerUid, record.id);
  const existing = await db.appointmentCache.get(key);

  if (
    existing &&
    typeof existing.appointment.version === "number" &&
    existing.appointment.version > record.version
  ) {
    return false;
  }

  await db.appointmentCache.put({
    cacheKey: key,
    ownerUid,
    appointmentId: record.id,
    childUid: record.childUid,
    status: record.status,
    scheduledAt: record.scheduledAt,
    updatedAt: record.updatedAt,
    appointment: record,
    cachedAt,
  });
  return true;
}

export const appointmentOfflineService = {
  cacheKey,

  /** Server-confirmed appointments for one account, newest schedule first. */
  async readCachedAppointments(ownerUid: string): Promise<AppointmentRecord[]> {
    if (!ownerUid) return [];
    const rows = await db.appointmentCache
      .where("ownerUid")
      .equals(ownerUid)
      .toArray();

    return rows
      .filter((row) => row.ownerUid === ownerUid)
      .map((row) => row.appointment)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  },

  async readCachedAppointment(
    ownerUid: string,
    appointmentId: string
  ): Promise<AppointmentRecord | null> {
    if (!ownerUid || !appointmentId) return null;
    const row = await db.appointmentCache.get(
      cacheKey(ownerUid, appointmentId)
    );
    if (!row || row.ownerUid !== ownerUid) return null;
    return row.appointment;
  },

  async readCachedChildren(
    ownerUid: string
  ): Promise<AppointmentChildDirectoryEntry[]> {
    if (!ownerUid) return [];
    const meta = await db.syncMeta.get(childrenKey(ownerUid));
    const snapshot = meta?.data as
      | LocalAppointmentChildDirectorySnapshot
      | undefined;
    if (!snapshot || snapshot.ownerUid !== ownerUid) return [];
    return Array.isArray(snapshot.children) ? snapshot.children : [];
  },

  /** Persist one server-confirmed record (realtime or mutation response). */
  async upsertConfirmedAppointment(
    ownerUid: string,
    incoming: AppointmentRecord
  ): Promise<void> {
    const changed = await upsertConfirmedRecord(
      ownerUid,
      incoming,
      new Date().toISOString()
    );
    if (changed) emitOutboxChanged(ownerUid);
  },

  /**
   * Replace the account's cached list from a fresh server response. Uses a
   * version-aware upsert so a slow list response cannot clobber a newer
   * realtime update.
   */
  async writeListSnapshot(params: {
    ownerUid: string;
    appointments: AppointmentRecord[];
    children?: AppointmentChildDirectoryEntry[];
  }): Promise<void> {
    const { ownerUid, appointments } = params;
    if (!ownerUid) return;

    const cachedAt = new Date().toISOString();

    await db.transaction(
      "rw",
      [db.appointmentCache, db.syncMeta],
      async () => {
        for (const record of appointments) {
          await upsertConfirmedRecord(ownerUid, record, cachedAt);
        }

        if (params.children) {
          const snapshot: LocalAppointmentChildDirectorySnapshot = {
            key: childrenKey(ownerUid),
            ownerUid,
            children: params.children,
            cachedAt,
          };
          await db.syncMeta.put({
            key: snapshot.key,
            lastSyncAt: Date.now(),
            data: snapshot,
          });
        }
      }
    );

    emitOutboxChanged(ownerUid);
  },

  /** Remove one cached record for this account only. */
  async removeCachedAppointment(
    ownerUid: string,
    appointmentId: string
  ): Promise<void> {
    if (!ownerUid) return;
    await db.appointmentCache.delete(cacheKey(ownerUid, appointmentId));
    emitOutboxChanged(ownerUid);
  },

  async listOutbox(ownerUid: string): Promise<LocalAppointmentOutboxRow[]> {
    if (!ownerUid) return [];
    const rows = await db.appointmentOutbox
      .where("ownerUid")
      .equals(ownerUid)
      .toArray();
    return rows
      .filter((row) => row.ownerUid === ownerUid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getOutboxForAppointment(
    ownerUid: string,
    appointmentId: string
  ): Promise<LocalAppointmentOutboxRow | undefined> {
    const rows = await this.listOutbox(ownerUid);
    return rows.find((row) => row.appointmentId === appointmentId);
  },

  async countQueued(ownerUid: string): Promise<number> {
    if (!ownerUid) return 0;
    return db.appointmentOutbox
      .where("[ownerUid+status]")
      .anyOf([
        [ownerUid, "QUEUED"],
        [ownerUid, "SENDING"],
      ])
      .count();
  },

  /**
   * Crash recovery: a page restart cannot own any in-flight network request.
   * Reclaim SENDING rows for this owner so the original operationId can be
   * retried safely (server idempotency prevents duplicate transitions).
   */
  async recoverInterrupted(ownerUid: string): Promise<void> {
    if (!ownerUid) return;
    if (interruptedResetOwners.has(ownerUid)) return;
    interruptedResetOwners.add(ownerUid);

    const now = new Date().toISOString();
    await db.transaction("rw", db.appointmentOutbox, async () => {
      const rows = await db.appointmentOutbox
        .where("ownerUid")
        .equals(ownerUid)
        .toArray();

      for (const row of rows) {
        if (row.status !== "SENDING") continue;
        await db.appointmentOutbox.update(row.operationId, {
          status: "QUEUED",
          leaseUntil: undefined,
          nextRetryAt: undefined,
          updatedAt: now,
        });
      }
    });

    emitOutboxChanged(ownerUid);
  },

  /**
   * Queue one action. Only one unresolved action per appointment is allowed so
   * two contradictory actions can never race each other.
   */
  async queueAction(input: {
    ownerUid: string;
    appointmentId: string;
    action: AppointmentAction;
    expectedVersion: number;
    payload?: AppointmentActionPayload;
    operationId?: string;
  }): Promise<LocalAppointmentOutboxRow> {
    const { ownerUid, appointmentId, action, expectedVersion } = input;

    if (!ownerUid) {
      throw new AppointmentOfflineError(
        "መለያ አልተለየም። እባክዎ እንደገና ይግቡ።",
        "NO_ACCOUNT"
      );
    }
    if (!appointmentId) {
      throw new AppointmentOfflineError("ቀጠሮው አልተገኘም።", "NOT_QUEUED");
    }
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      throw new AppointmentOfflineError(
        "የቅጂ ቁጥሩ ትክክል አይደለም። እባክዎ ያድሱ።",
        "OPERATION_MISMATCH"
      );
    }

    const operationId = input.operationId || newOperationId();
    const existing = await db.appointmentOutbox.get(operationId);

    if (existing) {
      if (existing.ownerUid !== ownerUid) {
        throw new AppointmentOfflineError(
          "የክወና መለያው ከሌላ መለያ ጋር ተመሳስሏል።",
          "OPERATION_MISMATCH"
        );
      }
      if (
        existing.appointmentId !== appointmentId ||
        existing.action !== action ||
        existing.expectedVersion !== expectedVersion
      ) {
        throw new AppointmentOfflineError(
          "የክወና መለያው ከተለየ እርምጃ ጋር ተመሳስሏል።",
          "OPERATION_MISMATCH"
        );
      }
      return existing;
    }

    const appointmentRows = await db.appointmentOutbox
      .where("ownerUid")
      .equals(ownerUid)
      .toArray();

    const blocking = appointmentRows.find(
      (row) =>
        row.appointmentId === appointmentId &&
        (row.status === "QUEUED" ||
          row.status === "SENDING" ||
          (row.status === "FAILED" && row.needsAttention))
    );

    if (blocking) {
      throw new AppointmentOfflineError(
        "በዚህ ቀጠሮ ላይ አስቀድሞ የተመዘገበ እርምጃ አለ። እባክዎ መጀመሪያ ይፈቱት።",
        "ACTION_ALREADY_QUEUED"
      );
    }

    const now = new Date().toISOString();
    const row: LocalAppointmentOutboxRow = {
      operationId,
      ownerUid,
      appointmentId,
      action,
      expectedVersion,
      payload: input.payload,
      status: "QUEUED",
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    await db.appointmentOutbox.add(row);
    emitOutboxChanged(ownerUid);
    return row;
  },

  /**
   * Remove a queued or failed action. An in-flight action is kept so a request
   * that may already have committed is never silently forgotten.
   */
  async removeOutboxOperation(
    ownerUid: string,
    operationId: string
  ): Promise<void> {
    const row = await db.appointmentOutbox.get(operationId);
    if (!row || row.ownerUid !== ownerUid) return;
    if (row.status === "SENDING") {
      throw new AppointmentOfflineError(
        "እርምጃው በመላክ ላይ ነው። እባክዎ ጥቂት ጊዜ ይጠብቁ።",
        "SENDING"
      );
    }
    await db.appointmentOutbox.delete(operationId);
    emitOutboxChanged(ownerUid);
  },

  /**
   * Drain queued actions for one account.
   *
   * 409/403/404/400 are permanent for that operation and are surfaced to the
   * user. 401 pauses the queue until re-authentication. Network/5xx pauses and
   * backs off. A 409 never silently retries against the new version.
   */
  async drain(ownerUid: string): Promise<{
    ran: boolean;
    processed: number;
    failed: number;
    needsAuth: boolean;
    remaining: number;
  }> {
    const summary = {
      ran: false,
      processed: 0,
      failed: 0,
      needsAuth: false,
      remaining: 0,
    };

    if (!ownerUid) return summary;
    await this.recoverInterrupted(ownerUid);
    if (typeof navigator !== "undefined" && !navigator.onLine) return summary;

    summary.ran = true;

    const rows = await db.appointmentOutbox
      .where("[ownerUid+status]")
      .anyOf([
        [ownerUid, "QUEUED"],
        [ownerUid, "SENDING"],
      ])
      .toArray();

    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const candidate of rows) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;

      const nowMs = Date.now();

      if (candidate.status === "SENDING") {
        const leaseUntil = candidate.leaseUntil ?? 0;
        if (leaseUntil > nowMs) continue; // another tab owns it
      } else if (
        candidate.nextRetryAt &&
        Date.parse(candidate.nextRetryAt) > nowMs
      ) {
        continue;
      }

      // Claim under a transaction so two tabs cannot both send.
      const claimed = await db.transaction(
        "rw",
        db.appointmentOutbox,
        async () => {
          const current = await db.appointmentOutbox.get(
            candidate.operationId
          );
          if (!current || current.ownerUid !== ownerUid) return undefined;
          if (current.status === "FAILED") return undefined;
          const startedAt = Date.now();
          if (
            current.status === "SENDING" &&
            (current.leaseUntil ?? 0) > startedAt
          ) {
            return undefined;
          }
          if (
            current.nextRetryAt &&
            Date.parse(current.nextRetryAt) > startedAt
          ) {
            return undefined;
          }

          const next: LocalAppointmentOutboxRow = {
            ...current,
            status: "SENDING",
            leaseUntil: startedAt + LEASE_MS,
            updatedAt: new Date(startedAt).toISOString(),
          };
          await db.appointmentOutbox.put(next);
          return next;
        }
      );

      if (!claimed) continue;

      const body = {
        operationId: claimed.operationId,
        expectedVersion: claimed.expectedVersion,
        action: claimed.action,
        ...(claimed.payload ?? {}),
      };

      let response: Response;
      try {
        response = await fetch(
          `/api/appointments/${encodeURIComponent(claimed.appointmentId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
      } catch {
        await this.releaseForRetry(
          ownerUid,
          claimed,
          "የኢንተርኔት ግንኙነት አልተሳካም። እርምጃው ለዝግጁነት ተመዝግቧል።"
        );
        break;
      }

      const result = (await response
        .json()
        .catch(() => ({}))) as Partial<AppointmentActionResponse> & {
        error?: string;
        code?: string;
        currentVersion?: number;
      };

      if (response.ok && result.success && result.appointment) {
        await upsertConfirmedRecord(
          ownerUid,
          result.appointment,
          new Date().toISOString()
        );
        await db.appointmentOutbox.delete(claimed.operationId);
        summary.processed += 1;
        emitOutboxChanged(ownerUid);
        continue;
      }

      if (response.status === 401) {
        await this.releaseForRetry(
          ownerUid,
          claimed,
          "እባክዎ እንደገና ይግቡ።"
        );
        summary.needsAuth = true;
        break;
      }

      if (
        response.status === 409 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 400 ||
        response.status === 422
      ) {
        // Permanent for this operation. If the server returned the current
        // record, cache it so the UI shows the truth instead of the stale
        // expectation. A 409 must never be replayed against a new version.
        if (result.appointment) {
          await upsertConfirmedRecord(
            ownerUid,
            result.appointment as AppointmentRecord,
            new Date().toISOString()
          );
        } else if (response.status === 409 || response.status === 404) {
          // Refresh the authoritative record when the server didn't include it.
          try {
            const fresh = await fetch(
              `/api/appointments/${encodeURIComponent(claimed.appointmentId)}`,
              { cache: "no-store" }
            );
            const freshJson = await fresh
              .json()
              .catch(() => ({})) as { appointment?: AppointmentRecord };
            if (fresh.ok && freshJson.appointment) {
              await upsertConfirmedRecord(
                ownerUid,
                freshJson.appointment,
                new Date().toISOString()
              );
            } else if (response.status === 404) {
              await db.appointmentCache.delete(
                cacheKey(ownerUid, claimed.appointmentId)
              );
            }
          } catch {
            // The failed operation is still surfaced; cache refresh is best-effort.
          }
        }
        await this.markFailed(
          ownerUid,
          claimed,
          result.error || "እርምጃው አልተፈቀደም።",
          result.code || `HTTP_${response.status}`
        );
        summary.failed += 1;
        continue;
      }

      // 5xx / 429 / unexpected: pause and retry later.
      await this.releaseForRetry(
        ownerUid,
        claimed,
        result.error || "ጊዜያዊ የአገልጋይ ችግር። እርምጃው ለዝግጁነት ተመዝግቧል።"
      );
      break;
    }

    summary.remaining = await this.countQueued(ownerUid);
    return summary;
  },

  async releaseForRetry(
    ownerUid: string,
    row: LocalAppointmentOutboxRow,
    errorMessage: string
  ): Promise<void> {
    const retryCount = row.retryCount + 1;
    const backoff = Math.min(
      MAX_BACKOFF_MS,
      1000 * Math.pow(2, Math.min(retryCount, 8))
    );
    await db.appointmentOutbox.update(row.operationId, {
      status: "QUEUED",
      leaseUntil: undefined,
      retryCount,
      nextRetryAt: new Date(Date.now() + backoff).toISOString(),
      lastError: errorMessage,
      updatedAt: new Date().toISOString(),
    });
    emitOutboxChanged(ownerUid);
  },

  async markFailed(
    ownerUid: string,
    row: LocalAppointmentOutboxRow,
    errorMessage: string,
    errorCode: string
  ): Promise<void> {
    await db.appointmentOutbox.update(row.operationId, {
      status: "FAILED",
      needsAttention: true,
      leaseUntil: undefined,
      retryCount: row.retryCount + 1,
      lastError: errorMessage,
      lastErrorCode: errorCode,
      updatedAt: new Date().toISOString(),
    });
    emitOutboxChanged(ownerUid);
  },
};
