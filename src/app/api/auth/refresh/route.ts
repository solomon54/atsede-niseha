// src/app/api/auth/refresh/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { createSessionFromUid } from "@/core/auth/session.service";

/**
 * GET — identity hydration.
 *
 * Historical name for the session identity endpoint; the web client still
 * boots with `fetch("/api/auth/refresh")` and expects `{ uid, familyId, role }`.
 * Kept as a separate handler (rather than a cross-route re-export) so both
 * transports resolve through the same auth guard.
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

    console.error("[GET /api/auth/refresh]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST — sliding session renewal.
 *
 * A 5-day session cookie used to expire mid-use, leaving the phone silently
 * broken. While the current session is still valid we mint a fresh one and
 * return it as a Bearer token for native clients (the web gets a new cookie).
 */
export async function POST() {
  try {
    const session = await requireSession();
    const token = await createSessionFromUid(session.uid);

    return NextResponse.json({
      success: true,
      token,
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

    console.error("[POST /api/auth/refresh]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
