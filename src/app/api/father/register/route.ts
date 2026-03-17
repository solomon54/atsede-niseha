// src/app/api/father/register/route.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { saveChildRecord } from "@/features/auth/services/childRegistration.service";
import { RegisterChildSchema } from "@/features/father/services/validators";

/**
 * API Route Handler for Spiritual Child Registration
 * This endpoint orchestrates the validation and persistence of new student records.
 * It serves as the bridge between the UI 'Covenant Mixer' and the Firestore Ledger.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    /**
     * Phase 1: Request Structure Validation
     * Verify the body contains the necessary fatherId and data objects.
     */
    if (!body || typeof body !== "object") {
      throw new Error("Invalid request payload structure");
    }

    const { fatherId, data } = body as { fatherId?: string; data?: unknown };

    /**
     * Phase 2: Security Context Verification
     * Ensure a valid Father ID is provided to establish the ecclesiastical hierarchy.
     * In a Governor context, this ID is the 'Target' Father UID.
     */
    if (!fatherId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Missing Spiritual Father context" },
        { status: 401 }
      );
    }

    /**
     * Phase 3: Data Integrity (Zod Validation)
     * Validates the 16+ fields against the RegisterChildSchema.
     * This ensures strict adherence to EOTC data standards (University, Diocese, Phone, etc).
     */
    const validation = RegisterChildSchema.safeParse(data);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    /**
     * Phase 4: Persistence
     * Delegate the database write operation to the service layer.
     * The service uses .set() which allows for future 're-registrations' to
     * act as updates if the Token (Document ID) remains the same.
     */
    const result = await saveChildRecord(fatherId, validation.data);

    return NextResponse.json({
      success: true,
      message:
        "Spiritual child record successfully indexed in the Sanctuary ledger ✞",
      id: result.id,
    });
  } catch (error: unknown) {
    /**
     * Phase 5: Graceful Error Handling
     * Differentiates between validation failures and internal infrastructure errors.
     */
    console.error("[STUDENT_REGISTRATION_CRITICAL]:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "የውስጥ ችግር ተፈጥሯል - እባክዎ ቆይተው ይሞክሩ", // Localized error for production
      },
      { status: 500 }
    );
  }
}
