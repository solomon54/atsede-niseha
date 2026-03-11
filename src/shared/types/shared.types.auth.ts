//src/shared/types/shared.types.auth.ts
import { JWTPayload } from "jose";

export const ROLES = {
  GOVERNOR: "GOVERNOR",
  FATHER: "FATHER",
  STUDENT: "STUDENT",
  USER: "USER",
} as const;

export type Role = keyof typeof ROLES;

/**
 * Combined Payload: Identity (Firebase) + Sovereignty (Atsede)
 */
export interface FirebaseIdTokenPayload extends JWTPayload {
  uid?: string; // From Firebase
  email?: string; // From Firebase
  role?: Role; // Custom claim added by your promote.ts script
  father?: string; // The spiritual father's ID
}

export interface UserSession {
  uid: string;
  email: string | null;
  role: Role;
  fatherId?: string; // Linked to the child/student
}

export interface AuthState {
  user: UserSession | null;
  isLoading: boolean;
  error: string | null;
}

export interface RelationResult {
  valid: boolean;
  since: string;
}
