//src/app/api/governor/directory/route.ts

import { NextRequest, NextResponse } from "next/server";

import { governanceService } from "@/features/governor/services/governance.service";

export async function GET(req: NextRequest) {
  try {
    // 1. RBAC Check (Ensuring the requester is a Governor)
    const requesterRole = req.headers.get("x-ats-role");
    if (requesterRole !== "GOVERNOR") {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "ያልተፈቀደ ሙከራ" },
        { status: 403 }
      );
    }

    // 2. Determine Request Type (Fathers or Students)
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "fathers";

    // 3. Service Call based on type
    let result;
    if (type === "students") {
      result = await governanceService.getStudents();
    } else {
      result = await governanceService.getFathers();
    }

    if (!result.ok) {
      return NextResponse.json(
        { code: "SERVICE_ERROR", message: result.errorMessage },
        { status: 500 }
      );
    }

    // 4. Return the data
    return NextResponse.json(result.data, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown Error";
    console.error("❌ DIRECTORY_API_ERROR:", msg);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
