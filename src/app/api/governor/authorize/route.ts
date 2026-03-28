//src/app/api/governor/authorize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  governanceService,
  SpiritualFatherSchema,
} from "@/features/governor/services/governance.service";

/**
 * Strict schema for the structural part of the request.
 * The 'uid' is the custom EOTC-ID provided by the Governor.
 */
const AuthorizationRequestSchema = z.object({
  uid: z.string().startsWith("EOTC-", "መለያው በ EOTC- መጀመር አለበት"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. RBAC Check (Role-Based Access Control)
    // Ensures only a user with the GOVERNOR role can hit this endpoint
    const requesterRole = req.headers.get("x-ats-role");
    if (requesterRole !== "GOVERNOR") {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "የበላይ ተቆጣጣሪ ፈቃድ ያስፈልጋል" },
        { status: 403 }
      );
    }

    // 2. Body Parsing
    const rawBody = await req.json();

    /**
     * Data Extraction:
     * We separate the 'uid' (EOTC ID) from the rest of the profile fields
     * so we can validate each part according to its specific schema.
     */
    const { uid, ...profileData } = rawBody;

    // 3. Structural Validation
    const structuralCheck = AuthorizationRequestSchema.safeParse({ uid });
    const profileCheck = SpiritualFatherSchema.safeParse(profileData);

    if (!structuralCheck.success || !profileCheck.success) {
      // Merge errors from both structural and profile validation
      const errors = {
        ...(structuralCheck.success
          ? {}
          : structuralCheck.error.flatten().fieldErrors),
        ...(profileCheck.success
          ? {}
          : profileCheck.error.flatten().fieldErrors),
      };

      return NextResponse.json(
        { code: "VALIDATION_ERROR", errors },
        { status: 400 }
      );
    }

    // 4. Service Execution
    // We pass the validated EOTC ID and the validated Profile to the service
    const result = await governanceService.authorizeSpiritualFather(
      structuralCheck.data.uid,
      profileCheck.data
    );

    if (!result.ok) {
      return NextResponse.json(
        { code: "SERVICE_ERROR", message: result.errorMessage },
        { status: 500 }
      );
    }

    // 5. Success Response
    return NextResponse.json({
      ok: true,
      message: "FATHER_AUTHORIZED_SUCCESSFULLY",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // Catch-all for JSON parsing errors or unexpected runtime crashes
    const message =
      error instanceof Error ? error.message : "Unknown internal error";

    console.error("❌ Critical Governance API Error:", message);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", details: message },
      { status: 500 }
    );
  }
}
