//src/core/middleware/auth.middleware.ts

import { NextRequest, NextResponse } from "next/server";

import { adminAuth } from "@/services/firebase/admin";

export async function verifySession(request: NextRequest) {
  const session = request.cookies.get("atsede_session")?.value;

  if (!session) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded;
  } catch {
    return null;
  }
}
