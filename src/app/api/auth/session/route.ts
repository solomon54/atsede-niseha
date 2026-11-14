// src/app/api/auth/session/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";

/**
 * Lightweight identity hydration for native clients.
 * SecureStore has no cookie jar, so mobile persists the token but not the
 * Firebase uid / familyId. This returns the authoritative values.
 */
export async function GET() {
  try {
    const session = await requireSession();

    return NextResponse.json({
      success: true,
      uid: session.uid,
      role: session.role,
      familyId: session.familyId,
      eotcUid: session.eotcUid,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (message === "USER_NOT_FOUND" || message === "INCOMPLETE_PROFILE") {
      return NextResponse.json(
        { error: "Forbidden", code: message },
        { status: 403 }
      );
    }

    console.error("[GET /api/auth/session]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
