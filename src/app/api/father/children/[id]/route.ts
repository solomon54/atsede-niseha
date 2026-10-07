// src/app/api/father/children/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";
import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";

/* ─────────────────────────────────────────────
   GET — fetch one student by eotcUid
───────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await adminDb.collection("Students").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "ልጁ አልተገኘም (Child not found)" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "መረጃውን መጫን አልተሳካም" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────
   PATCH — Father-only full profile update
───────────────────────────────────────────── */

const EthiopianDateSchema = z.object({
  day:   z.number().int().min(1).max(30),
  month: z.number().int().min(1).max(13),
  year:  z.number().int().min(1900).max(getTodayEthiopian().year),
});

const PatchSchema = z.object({
  // Identity
  secularName:    z.string().min(1).max(120).optional(),
  christianName:  z.string().min(1).max(80).optional(),
  gender:         z.enum(["MALE", "FEMALE"]).optional(),
  birthDate:      EthiopianDateSchema.optional(),
  spiritualTitle: z.string().max(40).optional(),
  // Academic
  university:      z.string().min(1).max(120).optional(),
  college:         z.string().min(1).max(120).optional(),
  department:      z.string().min(1).max(120).optional(),
  entryYear:       z.number().int().min(1990).max(getTodayEthiopian().year).optional(),
  programDuration: z.number().int().min(1).max(8).optional(),
  // Geography
  region:  z.string().max(80).optional(),
  zone:    z.string().max(80).optional(),
  city:    z.string().max(80).optional(),
  diocese: z.string().max(80).optional(),
  // Contact
  phone:    z.string().max(20).optional(),
  email:    z.string().email().optional(),
  language: z.string().max(40).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    /* 1. Auth — must be a logged-in FATHER */
    let session;
    try {
      session = await requireSession();
    } catch {
      return NextResponse.json({ error: "ያልተፈቀደ ተጠቃሚ" }, { status: 401 });
    }

    if (session.role !== "FATHER") {
      return NextResponse.json(
        { error: "ይህ ድርጊት ለአባት ብቻ ነው" },
        { status: 403 }
      );
    }

    /* 2. Resolve route param */
    const { id } = await params;

    /* 3. Locate student — look up by eotcUid (same as GET) */
    const snap = await adminDb
      .collection("Students")
      .where("eotcUid", "==", id)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: "ልጁ አልተገኘም" },
        { status: 404 }
      );
    }

    const studentDoc = snap.docs[0];
    const studentData = studentDoc.data();

    /* 4. Family isolation — only THIS Father's child */
    if (studentData.spiritualFatherId !== session.familyId &&
        studentData.fatherId !== session.uid &&
        studentData.familyId !== session.familyId) {
      return NextResponse.json(
        { error: "ይህ ልጅ የእርስዎ አይደለም" },
        { status: 403 }
      );
    }

    /* 5. Validate body */
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "ልክ ያልሆነ JSON" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ልክ ያልሆነ ግብዓት", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: "ምንም ለማዘመን አልተገኘም" },
        { status: 400 }
      );
    }

    /* 6. Write only the whitelisted fields */
    const update: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    await studentDoc.ref.update(update);

    return NextResponse.json({
      success: true,
      message: "መረጃው በተሳካ ሁኔታ ተዘምኗል",
      updated: parsed.data,
    });
  } catch (error) {
    console.error("[PATCH /api/father/children/[id]]", error);
    return NextResponse.json(
      { error: "የውስጥ ችግር ተፈጥሯል" },
      { status: 500 }
    );
  }
}
