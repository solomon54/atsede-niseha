// src/app/api/governor/overview/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/core/auth/session.service";
import { adminDb } from "@/services/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    let requesterRole = req.headers.get("x-ats-role");
    if (!requesterRole) {
      const session = await getSession();
      requesterRole = session?.role || null;
    }

    if (requesterRole !== "GOVERNOR") {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "የበላይ ተቆጣጣሪ ፈቃድ ያስፈልጋል" },
        { status: 403 }
      );
    }

    const [fCountSnap, sCountSnap, recentFathersSnap, recentStudentsSnap] =
      await Promise.all([
        adminDb.collection("Fathers").count().get(),
        adminDb.collection("Students").count().get(),
        adminDb
          .collection("Fathers")
          .orderBy("accessGrantedAt", "desc")
          .limit(5)
          .get(),
        adminDb
          .collection("Students")
          .orderBy("createdAt", "desc")
          .limit(5)
          .get(),
      ]);

    const recentFathers = recentFathersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eotcUid: data.eotcUid || doc.id,
        fullName: data.fullName || "ያልታወቀ",
        title: data.title || "ቀሲስ",
        diocese: data.diocese || "ያልተጠቀሰ",
        parish: data.parish || "ያልተጠቀሰ",
        phone: data.phone || "",
        email: data.email || "",
        accountClaimed: !!data.accountClaimed,
        isApproved: data.isApproved !== false,
        createdAt:
          data.accessGrantedAt?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
      };
    });

    const recentStudents = recentStudentsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eotcUid: data.eotcUid || doc.id,
        fullName: data.fullName || data.secularName || "ያልታወቀ",
        christianName: data.christianName || "",
        secularName: data.secularName || data.fullName || "",
        diocese: data.diocese || "ያልተጠቀሰ",
        status: data.status || "ACTIVE",
        accountClaimed: !!data.accountClaimed,
        createdAt:
          data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      fathersCount: fCountSnap.data().count,
      studentsCount: sCountSnap.data().count,
      systemStatus: "ONLINE",
      ledgerStatus: "SYNCED",
      recentFathers,
      recentStudents,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[GET /api/governor/overview]", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "የዳሽቦርድ መረጃ መጫን አልተቻለም" },
      { status: 500 }
    );
  }
}

