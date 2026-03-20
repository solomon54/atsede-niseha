/**
 * src/features/messaging/crypto/keyManager.ts
 * Deterministic Key Derivation (DKD) Logic
 */
import { FamilyID } from "../types/messaging.types";

declare global {
  var _ledger_key_cache: Map<string, CryptoKey> | undefined;
}

// 1. Hardened System Salt (Use a specific byte sequence)
const SYSTEM_SALT = new Uint8Array([
  0x45, 0x4f, 0x54, 0x43, 0x2d, 0x53, 0x41, 0x4e, 0x43, 0x54, 0x55, 0x41, 0x52,
  0x59, 0x2d, 0x56, 0x31,
]); // "EOTC-SANCTUARY-V1" in hex

/**
 * Derives a high-entropy AES-256-GCM key from a Family ID.
 */
export async function deriveKeyFromFamilyId(
  familyId: FamilyID
): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // 2. Pre-hash the familyId to ensure a consistent, high-entropy 32-byte input
  const rawIdBuffer = encoder.encode(familyId);
  const hashedIdBuffer = await crypto.subtle.digest("SHA-256", rawIdBuffer);

  const masterKey = await crypto.subtle.importKey(
    "raw",
    hashedIdBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SYSTEM_SALT,
      iterations: 100000,
      hash: "SHA-256",
    },
    masterKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Optimized loader with Type-Safe Global Caching.
 */
export async function loadKey(familyId: FamilyID): Promise<CryptoKey | null> {
  if (typeof window === "undefined") return null; // Prevent SSR crashes

  if (!globalThis._ledger_key_cache) {
    globalThis._ledger_key_cache = new Map();
  }

  const cached = globalThis._ledger_key_cache.get(familyId);
  if (cached) return cached;

  try {
    const key = await deriveKeyFromFamilyId(familyId);
    globalThis._ledger_key_cache.set(familyId, key);
    return key;
  } catch (e) {
    console.error("Master Key Derivation Failed:", e);
    return null;
  }
}

/* ============================================================
   COMPATIBILITY LAYER
   ============================================================ */

export async function generateAESKey(familyId: FamilyID): Promise<CryptoKey> {
  return deriveKeyFromFamilyId(familyId);
}

export async function storeKey(
  familyId: FamilyID,
  key: CryptoKey
): Promise<void> {
  if (!globalThis._ledger_key_cache) globalThis._ledger_key_cache = new Map();
  globalThis._ledger_key_cache.set(familyId, key);
}

export async function importKey(
  familyId: FamilyID | string
): Promise<CryptoKey> {
  return deriveKeyFromFamilyId(familyId as FamilyID);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return "DETERMINISTIC_VAULT_V1";
}
