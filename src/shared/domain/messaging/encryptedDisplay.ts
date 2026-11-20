// src/shared/domain/messaging/encryptedDisplay.ts
/**
 * Pure helpers for rendering end-to-end encrypted messages.
 *
 * An encrypted row must always resolve to one of three visible states:
 *   1. decrypted plaintext,
 *   2. explicit locked/error text, or
 *   3. plaintext for a locally owned optimistic row that has not been sent.
 *
 * It must never fall back to an ambiguous ellipsis, because that state has no
 * terminating condition when an encryption envelope is missing or corrupt.
 */

export const LOCKED_MESSAGE_PLACEHOLDER = "[የተቆለፈ መልእክት]";

export interface EncryptedMessageLike {
  id: string;
  content: string;
  isEncrypted?: boolean;
  status?: string;
  deletedAt?: number;
  encryption?: {
    algorithm?: string;
    keyId?: string;
    iv?: string;
  } | null;
}

export interface DecryptedMessageEntry {
  /** Plaintext or explicit locked placeholder. */
  text: string;
  /** Fingerprint of the ciphertext + envelope that produced `text`. */
  fingerprint: string;
}

function isLocalPending(message: EncryptedMessageLike): boolean {
  const status = typeof message.status === "string" ? message.status.toUpperCase() : "";
  return status === "PENDING" || status === "FAILED";
}

/**
 * Identify the exact encrypted payload, not merely the message id. A re-edit
 * produces a fresh IV and must not reuse an earlier plaintext result.
 */
export function encryptedContentFingerprint(
  message: EncryptedMessageLike
): string {
  const envelope = message.encryption;
  return JSON.stringify([
    message.content,
    envelope?.algorithm ?? null,
    envelope?.keyId ?? null,
    envelope?.iv ?? null,
  ]);
}

export function shouldAttemptDecryption(
  message: EncryptedMessageLike,
  entry?: DecryptedMessageEntry
): boolean {
  if (!message.isEncrypted || message.deletedAt) return false;
  // Locally owned optimistic rows keep their plaintext until the server row
  // with the encrypted envelope replaces them.
  if (isLocalPending(message)) return false;
  return entry?.fingerprint !== encryptedContentFingerprint(message);
}

export function resolveEncryptedDisplayText(
  message: EncryptedMessageLike,
  entry?: DecryptedMessageEntry
): string {
  if (!message.isEncrypted || message.deletedAt) return message.content;

  if (entry?.fingerprint === encryptedContentFingerprint(message)) {
    return entry.text;
  }

  if (isLocalPending(message)) return message.content;

  // Missing, malformed, or not-yet-resolved envelopes are explicit failures.
  // The caller still attempts decryption for these rows; once attempted, a
  // resolved entry (usually the locked placeholder) is stored permanently for
  // that fingerprint, so this transient state always terminates.
  return LOCKED_MESSAGE_PLACEHOLDER;
}
