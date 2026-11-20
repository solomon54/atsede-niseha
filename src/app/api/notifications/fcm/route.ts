// src/app/api/notifications/fcm/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

function profileCollectionForRole(role: string | undefined): string {
  if (role === "FATHER") return "Fathers";
  if (role === "GOVERNOR") return "Governors";
  return "Students";
}

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
    const platform = typeof body.platform === "string" ? body.platform : "android";
    const now = Date.now();

    // Device-scoped registration: one document per FCM token. A second device
    // no longer overwrites the first device's registration.
    await adminDb.collection("FcmTokens").doc(token).set({
      token,
      uid: session.uid,
      platform,
      createdAt: now,
      updatedAt: now,
    });

    // Keep the legacy profile field in sync for older clients/deployments.
    // Push resolution de-duplicates by token, so this cannot double-send.
    const collectionName = profileCollectionForRole(session.role);
    const snap = await adminDb
      .collection(collectionName)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        fcmToken: token,
        fcmPlatform: platform,
        fcmUpdatedAt: new Date(now).toISOString(),
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
 * Unregister only the calling device's token. Without an explicit token we
 * intentionally do nothing: deleting account-wide registrations would cut off
 * the user's other devices.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.fcmToken === "string" ? body.fcmToken.trim() : "";

    if (!token) {
      return NextResponse.json({ success: true, removed: false });
    }

    await adminDb.collection("FcmTokens").doc(token).delete().catch(() => {});

    const collectionName = profileCollectionForRole(session.role);
    const snap = await adminDb
      .collection(collectionName)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();
    if (!snap.empty && snap.docs[0].data()?.fcmToken === token) {
      await snap.docs[0].ref.update({
        fcmToken: null,
        fcmUpdatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, removed: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/notifications/fcm]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
