// src/app/api/notifications/fcm/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);

    if (!body || typeof body.fcmToken !== "string" || !body.fcmToken.trim()) {
      return NextResponse.json(
        { error: "fcmToken required" },
        { status: 400 }
      );
    }

    const token = body.fcmToken.trim();
    const platform = body.platform || "android";
    const collectionName =
      session.role === "FATHER"
        ? "Fathers"
        : session.role === "GOVERNOR"
        ? "Governors"
        : "Students";

    const snap = await adminDb
      .collection(collectionName)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        fcmToken: token,
        fcmPlatform: platform,
        fcmUpdatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/notifications/fcm]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Clear the stored device token on logout so a shared/sold device stops
 * receiving this user's pastoral notifications.
 */
export async function DELETE() {
  try {
    const session = await requireSession();
    const collectionName =
      session.role === "FATHER"
        ? "Fathers"
        : session.role === "GOVERNOR"
        ? "Governors"
        : "Students";

    const snap = await adminDb
      .collection(collectionName)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        fcmToken: null,
        fcmUpdatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/notifications/fcm]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

