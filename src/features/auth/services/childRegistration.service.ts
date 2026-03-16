// src/features/father/services/childRegistration.service.ts
import { RegisterChildFormData } from "@/features/father/services/validators";
import { adminDb } from "@/services/firebase/admin";

/**
 * Persists a validated spiritual child record to the Cloud Firestore 'students' collection.
 * * @param fatherId - The unique UID of the Spiritual Father performing the registration.
 * @param data - The validated data object containing all secular and ecclesiastical fields.
 * @returns A promise resolving to the generated EOTC primary document ID.
 */
export async function saveChildRecord(
  fatherId: string,
  data: RegisterChildFormData
) {
  // Use the uniquely generated EOTC token as the Firestore Document ID
  const childId = data.fullToken;

  /**
   * Derive the 'Short Token' for user-facing claim operations.
   * Logic: Extracts the Prefix and the Child Unique ID (e.g., EOTC-XXXX).
   * This allows students to claim their account without typing the middle Father ID.
   */
  const parts = childId.split("-");
  const shortToken = `${parts[0]}-${parts[2]}`;

  /**
   * Assemble the Final Record
   * Merges form data with system metadata (status, role, timestamps).
   */
  const record = {
    ...data, // Spreads 13+ validated fields (university, phone, photoUrl, etc.)
    fatherId, // Links the child to their specific Spiritual Father
    shortToken, // Indexed for the student search/claim flow
    status: "PENDING", // Account remains PENDING until student sets their password
    accountClaimed: false,
    role: "STUDENT",
    createdAt: new Date().toISOString(),

    /**
     * Language Normalization
     * If 'OTHER' was selected in the UI, we promote the custom input to the primary field.
     */
    language: data.language === "OTHER" ? data.customLanguage : data.language,
  };

  /**
   * Transactional Write
   * Uses .set() to ensure that if a request is retried, it updates the same document
   * rather than creating duplicates.
   */
  await adminDb.collection("students").doc(childId).set(record);

  return { id: childId };
}
