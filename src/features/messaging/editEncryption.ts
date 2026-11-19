// src/features/messaging/editEncryption.ts

export interface ClientEditEncryption {
  keyId: string;
  iv: string;
}

export type EditEncryptionValidation =
  | {
      ok: true;
      encryption: { algorithm: "AES-GCM"; keyId: string; iv: string };
    }
  | { ok: false; error: string };

/**
 * Client-side E2EE edits carry a fresh envelope for the new ciphertext.
 * Validate the established channelId context before letting the envelope
 * reach persistence; no AAD, key derivation, or stored format is changed.
 */
export function validateClientEditEncryption(
  input: unknown,
  channelId: string
): EditEncryptionValidation {
  if (input === undefined || input === null) {
    return { ok: false, error: "Missing encryption envelope" };
  }
  if (typeof input !== "object") {
    return { ok: false, error: "Invalid encryption envelope" };
  }

  const envelope = input as { keyId?: unknown; iv?: unknown };
  if (typeof envelope.keyId !== "string" || envelope.keyId !== channelId) {
    return { ok: false, error: "Encryption context mismatch" };
  }
  if (typeof envelope.iv !== "string" || envelope.iv.length === 0) {
    return { ok: false, error: "Invalid encryption IV" };
  }

  return {
    ok: true,
    encryption: {
      algorithm: "AES-GCM",
      keyId: envelope.keyId,
      iv: envelope.iv,
    },
  };
}

/** Broadcast both legacy and canonical ids without changing stored format. */
export function buildMessageEditedEvent(
  params: {
    messageId: string;
    content: string;
    editedAt: number;
    encryption?: {
      algorithm?: "AES-GCM";
      keyId: string;
      iv: string;
    } | null;
  }
): {
  id: string;
  messageId: string;
  content: string;
  editedAt: number;
  encryption?: { algorithm: "AES-GCM"; keyId: string; iv: string };
} {
  return {
    id: params.messageId,
    messageId: params.messageId,
    content: params.content,
    editedAt: params.editedAt,
    ...(params.encryption
      ? {
          encryption: {
            algorithm: "AES-GCM",
            keyId: params.encryption.keyId,
            iv: params.encryption.iv,
          },
        }
      : {}),
  };
}
