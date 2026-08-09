// src/features/notes/services/crypto.ts
/**
 * AES-256-GCM encryption for the local notes ledger.
 * Key derived deterministically from userId + device salt.
 * Never leaves the device.
 */

const SALT = new Uint8Array([
  0x41, 0x74, 0x73, 0x65, 0x64, 0x65, 0x4e, 0x6f,
  0x74, 0x65, 0x73, 0x56, 0x31, 0x4c, 0x4f, 0x43,
]); // "AtsedeNotesV1LOC"

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.digest("SHA-256", enc.encode(userId));
  const base = await crypto.subtle.importKey("raw", rawKey, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Simple base64 helpers (browser-safe)
function toB64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}
function fromB64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function encryptNote(userId: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    encoded as unknown as ArrayBuffer
  );
  return { ciphertext: toB64(new Uint8Array(buf)), iv: toB64(iv) };
}

export async function decryptNote(userId: string, ciphertext: string, iv: string): Promise<string> {
  try {
    const key = await deriveKey(userId);
    const buf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(iv) as unknown as ArrayBuffer },
      key,
      fromB64(ciphertext) as unknown as ArrayBuffer
    );
    return new TextDecoder().decode(buf);
  } catch {
    return "[ይዘቱን ማንበብ አልተቻለም]";
  }
}
