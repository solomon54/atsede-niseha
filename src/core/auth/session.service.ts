// src/core/auth/session.service.ts

import { cookies } from "next/headers";

import { adminAuth } from "@/services/firebase/admin";

const SESSION_NAME = "atsede_session";

/**
 * Exchange a UID for a Session Cookie by bypassing client-side login.
 * Used during account claiming and registration.
 */
export async function createSessionFromUid(uid: string) {
  // 1. Generate a Custom Token (Server-side)
  const customToken = await adminAuth.createCustomToken(uid);

  // 2. Exchange Custom Token for ID Token via Google Identity Toolkit REST API
  const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      headers: { "Content-Type": "application/json" },
    }
  );

  const data = await res.json();
  if (!data.idToken) throw new Error("Failed to exchange custom token");

  // 3. Hand off the real ID Token to your existing session logic
  return createSession(data.idToken);
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_NAME)?.value;
  if (!sessionCookie) return null;
  try {
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

export async function createSession(idToken: string) {
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

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_NAME);
}
