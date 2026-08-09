// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/core/auth/session.service";
import { adminDb } from "@/services/firebase/admin";

const COLLECTIONS: Record<string, string> = {
  STUDENT: "Students",
  FATHER: "Fathers",
  GOVERNOR: "Governors",
};

// GET — load current settings for the user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.role as string;
    const coll = COLLECTIONS[role];
    if (!coll) return NextResponse.json({ settings: {} });

    const snap = await adminDb
      .collection(coll)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ settings: {} });

    const data = snap.docs[0].data();
    return NextResponse.json({
      settings: {
        notifyAppointments: data.settings?.notifyAppointments ?? true,
        notifyMessages:     data.settings?.notifyMessages ?? true,
        language:           data.settings?.language ?? "am",
        // Father-only
        acceptingRequests:  data.settings?.acceptingRequests ?? true,
      },
    });
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — save settings
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.role as string;
    const coll = COLLECTIONS[role];
    if (!coll) return NextResponse.json({ error: "Unknown role" }, { status: 400 });

    const body = await req.json();

    // Whitelist only known setting keys
    const allowed = ["notifyAppointments", "notifyMessages", "language", "acceptingRequests"];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[`settings.${key}`] = body[key];
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const snap = await adminDb
      .collection(coll)
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    await snap.docs[0].ref.update(patch);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/settings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
