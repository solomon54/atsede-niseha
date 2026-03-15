// src/core/auth/session.service.ts

import { cookies } from "next/headers";

import { adminAuth } from "@/services/firebase/admin";

const SESSION_NAME = "atsede_session";

/**
 * Verify session and return decoded user info
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_NAME)?.value;

  if (!sessionCookie) return null;

  try {
    // Verify the session cookie using Firebase Admin
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    return decodedToken;
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}

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
    secure: process.env.NODE_ENV === "production",
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
