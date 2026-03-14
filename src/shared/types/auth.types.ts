// src/shared/types/auth.types.ts

/**
 * Strict User Roles within the Atsede Niseha ecosystem.
 */
export type UserRole = "FATHER" | "STUDENT" | "GOVERNOR";

/**
 * Standardized Error response from the Gateway API.
 */
export interface GatewayResponseError {
  success: false;
  error: string;
  code?: "NOT_FOUND" | "INACTIVE" | "UNAUTHORIZED" | "SERVER_ERROR";
}

/**
 * Data structure for a user who has already claimed their account.
 * This includes all metadata required for the Profile Preview and Session.
 */
export interface GatewayResponseLogin {
  success: true;
  action: "LOGIN";
  role: UserRole;
  eotcUid: string;
  displayName: string;
  email?: string;
  photoUrl?: string;
  title?: string; // Primarily for FATHER (e.g., መልአከ ሰላም)
  diocese?: string; // For FATHER and STUDENT
  parish?: string; // Primarily for FATHER
  university?: string; // Primarily for STUDENT
}

/**
 * Data structure for a user found in the registry but hasn't set up security yet.
 * The 'data' object contains the pre-registered clerical/academic info.
 */
export interface GatewayResponseClaim {
  success: true;
  action: "CLAIM";
  role: Exclude<UserRole, "GOVERNOR">;
  data: {
    eotcUid: string;
    displayName: string;
    email?: string;
    photoUrl?: string;
    diocese?: string;
    parish?: string;
    university?: string;
    title?: string;
  };
}

/**
 * Discriminated Union for Gateway API responses.
 */
export type GatewayResponse =
  | GatewayResponseError
  | GatewayResponseLogin
  | GatewayResponseClaim;

/**
 * The normalized application context used across the Auth flow and State Providers.
 * This represents the "Source of Truth" for the user's identity during onboarding.
 */
export interface AuthContext {
  eotcUid: string;
  role: UserRole;
  displayName: string;
  accountClaimed: boolean;
  email?: string;
  photoUrl?: string;
  diocese?: string;
  parish?: string;
  university?: string;
  title?: string;
}
