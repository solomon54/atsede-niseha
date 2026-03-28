// src/app/api/father/children/route.ts
import { NextResponse } from "next/server";

import { adminDb } from "@/services/firebase/admin";
import { BaseDirectoryRecord } from "@/shared/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fatherEotcUid = searchParams.get("fatherEotcUid");

    if (!fatherEotcUid) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    // DEBUG: Log this to your terminal to see what the server is actually looking for
    console.log("🔍 Fetching children for Father UID:", fatherEotcUid);

    const snapshot = await adminDb
      .collection("Students")
      // Ensure this key matches EXACTLY what is in your Firestore documents
      .where("spiritualFatherId", "==", fatherEotcUid)
      .orderBy("createdAt", "desc")
      .get();

    console.log(`✅ Found ${snapshot.size} children`);

    const children = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Ensure date doesn't break JSON serialization
      createdAt:
        doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));

    return NextResponse.json({ success: true, children, count: snapshot.size });
  } catch (error: any) {
    console.error("Directory Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
