//src/features/messaging/crypto/aes.ts
/**
 * AES-256-GCM encryption/decryption utilities.
 * EOTC Sacred Ledger — Production-Ready
 */

import { decode as base64Decode, encode as base64Encode } from "./serializer";

export interface EncryptedPayload {
  iv: string; // Base64-encoded IV
  ciphertext: string; // Base64-encoded ciphertext
}

/**
 * Encrypt a string using AES-GCM
 */
export async function encryptAES(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  // Use a standard Uint8Array for the 96-bit nonce
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encoded = encoder.encode(plaintext);

  /**
   * 🔥 CRITICAL BUILD FIX:
   * We cast 'iv' to 'any' because strict TS DOM types (lib.dom.d.ts)
   * incorrectly flag Uint8Array as incompatible with BufferSource
   * due to SharedArrayBuffer property mismatches.
   */
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    encoded
  );

  return {
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt AES-GCM encrypted payload
 */
export async function decryptAES(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  try {
    const iv = base64Decode(payload.iv);
    const ciphertext = base64Decode(payload.ciphertext);

    /**
     * 🔥 CRITICAL BUILD FIX:
     * Casting 'iv' and 'ciphertext' to 'any' to satisfy the
     * SubtleCrypto.decrypt signature in strict environments.
     */
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error(
      "[Crypto Error] Decryption failed. Key mismatch or corrupted data.",
      error
    );
    return "[Decryption Failed: Key Mismatch]";
  }
}
