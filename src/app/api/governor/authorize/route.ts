//src/app/api/governor/authorize/route.ts
import { NextRequest, NextResponse } from "next/server";

import {
  governanceService,
  SpiritualFatherSchema,
} from "@/features/governor/services/governance.service";

/**
 * GOVERNOR AUTHORIZATION ENDPOINT
 */
export async function POST(req: NextRequest) {
  try {
    const requesterRole = req.headers.get("x-ats-role");
    if (requesterRole !== "GOVERNOR") {
      console.warn(
        `🚫 Unauthorized attempt to authorize father by role: ${requesterRole}`
      );
      return NextResponse.json(
        { error: "UNAUTHORIZED_GOVERNANCE" },
        { status: 403 }
      );
    }

    // Parse the request
    const body = await req.json();
    const { uid, ...profile } = body;

    if (!uid) {
      return NextResponse.json({ error: "MISSING_UID" }, { status: 400 });
    }

    // Validate profile using Zod
    const parseResult = SpiritualFatherSchema.safeParse(profile);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "INVALID_PROFILE", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    // Execute authorization
    const result = await governanceService.authorizeSpiritualFather(
      uid,
      parseResult.data
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.errorMessage }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "FATHER_AUTHORIZED_SUCCESSFULLY",
    });
  } catch (error) {
    console.error("❌ Critical Governance API Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
