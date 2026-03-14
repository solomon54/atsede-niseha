//src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

import { destroySession } from "@/core/auth/session.service";

export async function POST() {
  await destroySession();

  return NextResponse.json({
    success: true,
  });
}
