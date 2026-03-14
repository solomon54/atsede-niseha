// src/core/auth/claim.service.ts

import { z } from "zod";

import { adminAuth, adminDb } from "@/services/firebase/admin";

import { AuthError } from "./auth.errors";
import { createSession } from "./session.service";

/**
 * Validation Schema
 * FIX: Added GOVERNOR to the enum
 */
const ClaimSchema = z.object({
  eotcUid: z.string().min(4),
  password: z.string().min(8),
  role: z.enum(["FATHER", "STUDENT", "GOVERNOR"]),
});

export async function claimAccount(raw: unknown) {
  const body = ClaimSchema.parse(raw);
  const collection =
    body.role === "GOVERNOR"
      ? "Governors"
      : body.role === "FATHER"
      ? "Fathers"
      : "Students";

  let uidCreated: string | null = null;

  await adminDb.runTransaction(async (tx) => {
    // PROFESSIONAL FIX: Governors use Doc ID, others use field query
    let docRef;
    let data;

    if (body.role === "GOVERNOR") {
      const gDoc = await tx.get(
        adminDb.collection(collection).doc(body.eotcUid)
      );
      if (!gDoc.exists) throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
      docRef = gDoc.ref;
      data = gDoc.data();
    } else {
      const query = await adminDb
        .collection(collection)
        .where("eotcUid", "==", body.eotcUid)
        .limit(1)
        .get();
      if (query.empty) throw new AuthError("መለያ አልተገኘም", "NOT_FOUND", 404);
      docRef = query.docs[0].ref;
      data = query.docs[0].data();
    }

    if (!data || data.accountClaimed) {
      throw new AuthError("ይህ መለያ ቀድሞ ተይዟል", "ALREADY_CLAIMED", 400);
    }

    // Ensure we have an email
    if (!data.email) {
      throw new AuthError(
        "ለአካውንት ምስረታ ኢሜል ያስፈልጋል። እባክዎ መምህርዎን ያማክሩ።",
        "VALIDATION_ERROR",
        400
      );
    }

    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: body.password,
      displayName:
        data.christianName || data.fullName || data.secularName || "User",
    });

    uidCreated = userRecord.uid;

    await adminAuth.setCustomUserClaims(userRecord.uid, { role: body.role });

    tx.update(docRef, {
      uid: userRecord.uid,
      accountClaimed: true,
      status: "ACTIVE",
      lastLogin: new Date().toISOString(),
    });
  });

  if (!uidCreated)
    throw new AuthError("Account creation failed", "SERVER_ERROR", 500);

  await createSession(uidCreated);

  return {
    success: true,
    redirect: `/${body.role.toLowerCase()}`,
  };
}
