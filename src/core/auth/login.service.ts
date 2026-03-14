// src/core/auth/login.service.ts

import { z } from "zod";

import { adminAuth, adminDb } from "@/services/firebase/admin";

import { AuthError } from "./auth.errors";
import { createSession } from "./session.service";

const LoginSchema = z.object({
  eotcUid: z.string().min(3),
  password: z.string().min(8),
});

export async function loginUser(raw: unknown) {
  const body = LoginSchema.parse(raw);
  const id = body.eotcUid.trim().toUpperCase();

  // 1. Locate account
  const [govQuery, fatherQuery, studentQuery] = await Promise.all([
    adminDb.collection("Governors").where("eotcUid", "==", id).limit(1).get(),
    adminDb.collection("Fathers").where("eotcUid", "==", id).limit(1).get(),
    adminDb.collection("Students").where("eotcUid", "==", id).limit(1).get(),
  ]);

  const doc = !govQuery.empty
    ? govQuery.docs[0]
    : !fatherQuery.empty
    ? fatherQuery.docs[0]
    : !studentQuery.empty
    ? studentQuery.docs[0]
    : null;

  if (!doc) throw new AuthError("መለያ አልተገኘም", "ACCOUNT_NOT_FOUND", 404);

  const record = doc.data();

  if (!record.accountClaimed)
    throw new AuthError("መለያው አልተነሳም", "ACCOUNT_NOT_CLAIMED", 403);
  if (!record.email)
    throw new AuthError("የኢሜይል አድራሻ አልተገኘም", "CONFIG_ERROR", 500);

  /**
   * 2. Verify password
   */
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: record.email.trim().toLowerCase(),
        password: body.password,
        returnSecureToken: true,
      }),
    }
  );

  const authData = await authResponse.json();

  if (!authResponse.ok) {
    throw new AuthError("የይለፍ ቃል ስህተት ነው", "INVALID_LOGIN", 401);
  }

  // authData.idToken is the "Valid Firebase ID Token" the error was asking for
  const idToken = authData.idToken;
  const uid = authData.localId;

  // 3. Verify Role Claims
  const user = await adminAuth.getUser(uid);
  const role = user.customClaims?.role;

  if (!role) throw new AuthError("የመግቢያ ፈቃድ የሎትም", "ROLE_MISSING", 403);

  // 4. Finalize Session - PASS THE idToken INSTEAD OF UID
  await createSession(idToken);

  return {
    success: true,
    role,
    redirect: `/${role.toLowerCase()}`,
  };
}
