// src/features/father/services/childRegistration.service.ts

import { RegisterChildFormData } from "@/features/father/services/validators";
import { adminDb } from "@/services/firebase/admin";
import { StudentRecord } from "@/shared/types";

export async function saveChildRecord(
  fatherId: string,
  data: RegisterChildFormData
): Promise<{ id: string }> {
  const childId: string = data.fullToken;

  try {
    // 1. EXISTENCE CHECK
    const existingDoc = await adminDb.collection("Students").doc(childId).get();

    if (existingDoc.exists) {
      const existingData = existingDoc.data() as StudentRecord;

      // 2. PROTECTION LOGIC
      // If the student has already claimed their account, the Father can no longer
      // overwrite it via the registration form for security reasons.
      if (existingData.accountClaimed) {
        throw new Error(
          "ይህ ተማሪ ቀድሞውኑ አካውንቱን አረጋግጧል። መረጃውን መቀየር አይቻልም። (Account already claimed)"
        );
      }

      // 3. OWNERSHIP CHECK (Optional but Recommended)
      // Ensure this Father is the one who originally registered the child
      if (existingData.fatherId !== fatherId) {
        throw new Error(
          "ይህ መለያ ቁጥር በሌላ አባት ቀድሞ ተመዝግቧል። (Token already registered by another Father)"
        );
      }
    }

    const { fullToken, ...baseFormData } = data;

    const record: Omit<StudentRecord, "uid"> = {
      ...baseFormData,
      fatherId, // Auth UID for security rules/ownership
      eotcUid: childId, // The generated Token
      status: "PENDING",
      accountClaimed: false,
      role: "STUDENT",
      createdAt: existingDoc.exists
        ? existingDoc.data()?.createdAt
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fullName: data.secularName,
      // FIX: Use the spiritualFatherId from data (EOTC ID) instead of fatherId (Auth UID)
      spiritualFatherId: data.spiritualFatherId ?? "",
      diocese: data.region,
    };

    // 4. ATOMIC WRITE
    await adminDb
      .collection("Students")
      .doc(childId)
      .set(record, { merge: true });

    return { id: childId };
  } catch (error: unknown) {
    console.error("Critical Firestore Write Error:", error);

    if (error instanceof Error) throw error;
    throw new Error("የመረጃ ቋት ምዝገባ አልተሳካም");
  }
}
