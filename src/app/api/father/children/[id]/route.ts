// src/app/api/father/children/[id]/route.ts

import { NextResponse } from "next/server";

import { adminDb } from "@/services/firebase/admin";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
    return NextResponse.json({ error: "መረጃውን መጫን አልተሳካም" }, { status: 500 });
  }
}
