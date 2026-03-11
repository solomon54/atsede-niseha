import { createHash, randomBytes } from "crypto";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/services/firebase/client";
import { StudentInput, TokenResponse } from "@/shared/types";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a cryptographically secure 6-digit alphanumeric code.
 * Excludes confusing characters like O, 0, I, 1.
 */
const generateSecureCode = (length = 6): string => {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
};

/**
 * Creates a SHA-256 hash of the token for secure database indexing.
 * This allows us to search for tokens without storing them in plain text.
 */
const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

/**
 * Issue Invitation Tokens - Atsede Niseha Logic
 * * This service links a student to a specific Father via a secure,
 * one-time use token. It uses a database transaction to ensure atomicity.
 * * @param fatherId - Unique ID of the Spiritual Father (Clergy)
 * @param studentsList - Array of student data objects
 * @param expiryHours - Token validity period (default 24h)
 */
export const issueInvitationTokens = async (
  fatherId: string,
  studentsList: StudentInput[],
  expiryHours = 24
): Promise<{ success: boolean; tokens?: TokenResponse[]; error?: string }> => {
  try {
    return await runTransaction(db, async (transaction) => {
      const resultDetails: TokenResponse[] = [];
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + expiryHours);

      for (const student of studentsList) {
        let uniqueCode = "";
        let hashedCode = "";
        let attempts = 0;

        // Collision-proof loop: ensures the generated hash doesn't exist in DB
        while (true) {
          if (++attempts > 10)
            throw new Error("Unique token generation failed.");

          uniqueCode = generateSecureCode();
          hashedCode = hashToken(uniqueCode);

          // Check for hash collision in the InvitationTokens collection
          const q = query(
            collection(db, "InvitationTokens"),
            where("tokenHash", "==", hashedCode)
          );

          const snapshot = await getDocs(q);
          if (snapshot.empty) break; // Valid unique code found
        }

        const newTokenRef = doc(collection(db, "InvitationTokens"));

        // Atomically set the token document
        transaction.set(newTokenRef, {
          tokenHash: hashedCode, // Indexed for fast lookup
          createdBy: fatherId, // Links student to this Father
          studentName: student.secularName,
          linkedStudentData: student, // Pre-filled profile data
          expiryDate: expiryDate,
          isUsed: false,
          createdAt: serverTimestamp(),
        });

        resultDetails.push({
          displayName: student.secularName,
          invitationCode: uniqueCode, // Plain text code for the Father to share
        });
      }

      return { success: true, tokens: resultDetails };
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Critical Token Issue Error:", errorMessage);
    return { success: false, error: "Failed to generate invitation tokens." };
  }
};
