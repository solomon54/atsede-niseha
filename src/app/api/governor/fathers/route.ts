//src/app/api/governor/fathers/route.ts

import { NextResponse } from "next/server";

import { getSession } from "@/core/auth/session.service";
import { adminDb } from "@/services/firebase/admin";

export async function GET() {
  const session = await getSession();
  if (session?.role !== "GOVERNOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const snapshot = await adminDb.collection("Fathers").limit(20).get();
  const fathers = snapshot.docs.map((doc) => ({
    uid: doc.data().uid,
    fullName: doc.data().fullName,
    eotcUid: doc.data().eotcUid,
  }));

  return NextResponse.json(fathers);
}
