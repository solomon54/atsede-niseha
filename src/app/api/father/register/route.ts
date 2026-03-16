// src/app/api/father/register/route.ts
import { NextResponse } from "next/server";

// FIX: Updated path to match your actual service location
import { saveChildRecord } from "@/features/auth/services/childRegistration.service";
import { RegisterChildSchema } from "@/features/father/services/validators";

/**
 * API Route Handler for Spiritual Child Registration
 * This endpoint orchestrates the validation and persistence of new student records.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fatherId, data } = body;

    /**
     * Phase 1: Data Integrity
     * Validate the incoming payload against the 13+ fields defined in RegisterChildSchema.
     * This includes phone formatting, Ethiopian date logic, and language conditions.
     */
    const validation = RegisterChildSchema.safeParse(data);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Data Validation Failed",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    /**
     * Phase 2: Security Context
     * Ensure a valid Father ID is provided to establish the ecclesiastical hierarchy.
     */
    if (!fatherId) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Father Context" },
        { status: 401 }
      );
    }

    /**
     * Phase 3: Persistence
     * Delegate the database write operation to the service layer.
     */
    const result = await saveChildRecord(fatherId, validation.data);

    return NextResponse.json({
      success: true,
      message:
        "Spiritual child record successfully indexed in the Sanctuary ledger",
      id: result.id,
    });
  } catch (error: any) {
    // Log critical infrastructure failures for administrative review
    console.error("[STUDENT_REGISTRATION_CRITICAL]:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
