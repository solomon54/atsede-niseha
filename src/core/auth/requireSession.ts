//src/core/auth/requireSession.ts

/**
 * Auth Guard
 * ------------------------------------------------
 * Converts existing session into strict API context.
 * Uses existing session.service.ts
 */

import { getSession } from "./session.service";

export interface SessionUser {
  uid: string;
  familyId: string;
  role?: string;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  /**
   * Firebase session cookie already verified cryptographically.
   * Now we expose only what the domain needs.
   */

  return {
    uid: session.uid,
    // assuming you stored this as custom claim
    familyId: session.familyId as string,
    role: session.role as string | undefined,
  };
}
