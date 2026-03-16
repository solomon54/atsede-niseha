//src/app/api/auth/claim/route.ts
import { NextResponse } from "next/server";

import { mapAuthError } from "@/core/auth/auth.errors";
import { claimAccount } from "@/core/auth/claim.service";

/**
 * AUTH CLAIM GATEWAY
 * The primary entry point for account activation.
 * Captures the claim request and returns a standardized JSON response.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = await claimAccount(body);

    return NextResponse.json(result);
  } catch (error: unknown) {
    // PROFESSIONAL FIX: Using 'unknown' with type mapping
    const mapped = mapAuthError(error);

    return NextResponse.json(
      {
        success: false,
        error: mapped.error,
        code: mapped.code,
      },
      { status: mapped.status }
    );
  }
}
