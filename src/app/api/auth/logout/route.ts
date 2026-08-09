// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

import { destroySession } from "@/core/auth/session.service";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await destroySession().catch(() => {});

  // Redirect back to the gateway — works for both form POST and fetch()
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}

export const dynamic = "force-dynamic";
