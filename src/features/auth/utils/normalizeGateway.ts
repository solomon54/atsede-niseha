// src/features/auth/utils/normalizeGateway.ts

import { AuthContext, GatewayResponse } from "@/shared/types/auth.types";

/**
 * Result type for the normalization process to ensure
 * the UI handles errors gracefully.
 */
type NormalizeResult =
  | { success: true; context: AuthContext }
  | { success: false; message: string };

/**
 * Normalizes Gateway API responses into a clean UI context.
 * Strictly typed to prevent 'any' and data loss.
 * * This function acts as a transformer that converts raw API
 * payloads into the robust AuthContext needed for the
 * ProfilePreview and Security steps.
 */
export function normalizeGateway(res: GatewayResponse): NormalizeResult {
  // 1. Handle Error Responses
  if (!res.success) {
    return {
      success: false,
      message: res.error || "ያልታወቀ ስህተት አጋጥሟል",
    };
  }

  // 2. Handle LOGIN Action (Existing users)
  if (res.action === "LOGIN") {
    return {
      success: true,
      context: {
        eotcUid: res.eotcUid,
        role: res.role,
        displayName: res.displayName,
        email: res.email,
        photoUrl: res.photoUrl,
        title: res.title,
        diocese: res.diocese,
        parish: res.parish,
        university: res.university,
        accountClaimed: true,
      },
    };
  }

  // 3. Handle CLAIM Action (New/Unverified users)
  if (res.action === "CLAIM") {
    const { data, role } = res;
    return {
      success: true,
      context: {
        eotcUid: data.eotcUid,
        role: role,
        displayName: data.displayName,
        email: data.email,
        photoUrl: data.photoUrl,
        title: data.title,
        diocese: data.diocese,
        parish: data.parish,
        university: data.university,
        accountClaimed: false,
      },
    };
  }

  // Fallback for unexpected action types
  return {
    success: false,
    message: "የማይታወቅ የፍቃድ አይነት ተገኝቷል",
  };
}
