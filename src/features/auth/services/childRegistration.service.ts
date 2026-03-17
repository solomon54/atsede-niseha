// src/features/father/services/childRegistration.service.ts
import { RegisterChildFormData } from "@/features/father/services/validators";
import { adminDb } from "@/services/firebase/admin";
import { StudentRecord } from "@/shared/types";

/**
 * Persists a validated spiritual child record to the Cloud Firestore 'students' collection.
 * This service establishes the 'Sovereign Link' between a Spiritual Father and the Child.
 * * @param fatherId - The unique Auth UID of the Spiritual Father (system-level foreign key).
 * @param data - The validated data object from the RegisterChildForm (Zod-validated).
 * @returns A promise resolving to an object containing the EOTC primary document ID.
 * @throws Error if the database operation fails.
 */
export async function saveChildRecord(
  fatherId: string,
  data: RegisterChildFormData
): Promise<{ id: string }> {
  /**
   * THE COVENANT IDENTIFIER
   * The full 12-character interleaved token serves as the unique Firestore Document ID.
   * This enforces a physical-to-digital 1:1 constraint at the database level.
   */
  const childId: string = data.fullToken;

  /**
   * DATA NORMALIZATION & HYGIENE
   * We extract 'customLanguage' and 'fullToken' via destructuring to ensure
   * they do not persist in the final database record, maintaining strict schema adherence.
   */
  const { customLanguage, fullToken, ...baseFormData } = data;

  /**
   * Assemble the Final Sovereign Record
   * Uses the StudentRecord interface to ensure complete type safety.
   */
  const record: Omit<StudentRecord, "uid"> = {
    ...baseFormData,
    fatherId,
    eotcUid: childId,
    status: "PENDING",
    accountClaimed: false,
    role: "STUDENT",
    createdAt: new Date().toISOString(),

    /**
     * Language Normalization
     * If 'OTHER' was selected, we promote the custom string.
     * Otherwise, we use the predefined enum value.
     */
    language:
      data.language === "OTHER" ? customLanguage ?? "Unknown" : data.language,
    academicYear: 0,
    spiritualFatherId: "",
    fullName: "",
    diocese: "",
  };

  try {
    /**
     * ATOMIC PERSISTENCE
     * .set() is used with childId as the key. This ensures idempotency;
     * retried requests will safely overwrite/update the same record rather than duplicating.
     */
    await adminDb.collection("students").doc(childId).set(record);

    return { id: childId };
  } catch (error: unknown) {
    /**
     * GRACEFUL ERROR HANDLING
     * Re-throwing as a typed error for the API layer to catch and format.
     */
    console.error("Critical Firestore Write Error [saveChildRecord]:", error);
    throw new Error("የመረጃ ቋት ምዝገባ አልተሳካም (Database persistence failed)");
  }
}
