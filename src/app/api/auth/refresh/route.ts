// src/app/api/auth/session/route.ts

import { NextRequest, NextResponse } from "next/server";

import { createSessionFromUid, getSession } from "@/core/auth/session.service";
import { adminAuth, adminDb } from "@/services/firebase/admin";

export async function GET(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let familyId = "";
  let role: string | undefined;

  // Fathers
  const fatherSnap = await adminDb
    .collection("Fathers")
    .where("uid", "==", session.uid)
    .limit(1)
    .get();

  if (!fatherSnap.empty) {
    const data = fatherSnap.docs[0].data();

    familyId = data.familyId || data.fatherId || data.uid;
    role = "FATHER";
  }

  // Students
  if (!role) {
    const studentSnap = await adminDb
      .collection("Students")
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!studentSnap.empty) {
      const data = studentSnap.docs[0].data();

      if (!data.familyId && !data.fatherId) {
        throw new Error("STUDENT record missing familyId/fatherId");
      }

      familyId = data.familyId || data.fatherId;
      role = "STUDENT";
    }
  }

  // Governors
  if (!role) {
    const governorSnap = await adminDb
      .collection("Governors")
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (!governorSnap.empty) {
      role = "GOVERNOR";
      familyId = "GOVERNOR_GLOBAL"; // ✅ avoid empty string
    }
  }

  if (!role) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    uid: session.uid,
    familyId,
    role,
  });
}
