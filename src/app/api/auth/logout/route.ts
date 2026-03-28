// src/features/auth/hooks/useLogout.ts
import { NextResponse } from "next/server";

import { destroySession } from "@/core/auth/session.service";

// Ensure the function is explicitly typed and exported correctly
export async function POST(): Promise<NextResponse> {
  try {
    await destroySession();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Optional: Force dynamic to ensure it's not pre-rendered at build time
export const dynamic = "force-dynamic";
