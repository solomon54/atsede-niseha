// src/core/auth/session.service.ts

import { cookies } from "next/headers";

import { adminAuth } from "@/services/firebase/admin";

const SESSION_NAME = "atsede_session";

/**
 * Create secure session cookie
 * @param idToken - The valid ID token from the Identity Toolkit login
 */
export async function createSession(idToken: string) {
  // Exchange the real ID Token for a session cookie
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: 5 * 24 * 60 * 60 * 1000, // 5 days
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Professional: only secure in production
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Destroy session
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_NAME);
}
