// src/app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/core/auth/session.service";
import { adminAuth } from "@/services/firebase/admin";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    // 1. Get the user's email from Firebase Auth
    const userRecord = await adminAuth.getUser(session.uid);
    if (!userRecord.email) {
      return NextResponse.json(
        { error: "ኢሜይል አልተገኘም" },
        { status: 400 }
      );
    }

    // 2. Verify current password via Identity Toolkit (signIn)
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userRecord.email,
          password: parsed.data.currentPassword,
          returnSecureToken: false,
        }),
      }
    );

    if (!verifyRes.ok) {
      return NextResponse.json(
        { error: "የአሁኑ ይለፍ ቃል ትክክል አይደለም" },
        { status: 400 }
      );
    }

    // 3. Update to new password via Admin SDK
    await adminAuth.updateUser(session.uid, {
      password: parsed.data.newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[change-password]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
