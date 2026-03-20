//src/app/api/message/list/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  ChannelRole,
  Message,
  UID,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

/**
 * Interface for the lookup map to avoid 'any'
 */
interface SenderProfile {
  name: string;
  photo: string | null;
  role: ChannelRole;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { error: "አንቀጽ (Channel) ያስፈልጋል" },
        { status: 400 }
      );
    }

    // 1. SECURITY: Explicit Membership Check
    const memberSnap = await adminDb
      .collection("ChannelMembers")
      .where("channelId", "==", channelId)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return NextResponse.json(
        { error: "ፈቃድ የለዎትም (Access Denied)" },
        { status: 403 }
      );
    }

    // 2. FETCH MESSAGES: Typed as an array of the Message interface
    const msgSnapshot = await adminDb
      .collection("Channels")
      .doc(channelId)
      .collection("Messages")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    if (msgSnapshot.empty) return NextResponse.json([]);

    // Cast Firestore data to partial Message type
    const rawMessages = msgSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<Message>;

    // 3. THE JOIN LOGIC: Zero 'any'
    // Extract unique sender UIDs
    const senderIds: UID[] = [...new Set(rawMessages.map((m) => m.senderId))];

    if (senderIds.length === 0) return NextResponse.json(rawMessages);

    // Parallel fetch for Students and Fathers
    const [studentsSnap, fathersSnap] = await Promise.all([
      adminDb.collection("Students").where("uid", "in", senderIds).get(),
      adminDb.collection("Fathers").where("uid", "in", senderIds).get(),
    ]);

    // Typed Profile Map
    const profileMap = new Map<UID, SenderProfile>();

    studentsSnap.docs.forEach((d) => {
      const data = d.data();
      profileMap.set(data.uid as UID, {
        name: data.fullName || "የቤተሰብ አባል",
        photo: data.photoUrl || null,
        role: "CHILD",
      });
    });

    fathersSnap.docs.forEach((d) => {
      const data = d.data();
      profileMap.set(data.uid as UID, {
        name: data.fullName || "መምህር",
        photo: data.photoUrl || null,
        role: "FATHER",
      });
    });

    // 4. ASSEMBLE ENRICHED MESSAGES
    // We map raw messages to the enriched shape expected by the UI
    const enrichedMessages = rawMessages.map((msg) => {
      const profile = profileMap.get(msg.senderId);
      return {
        ...msg,
        senderName: profile?.name || "የቤተሰብ አባል",
        senderRole: profile?.role || "CHILD",
        senderPhoto: profile?.photo || null,
      };
    });

    // 5. OFFLINE RESILIENCE HEADERS
    return NextResponse.json(enrichedMessages, {
      status: 200,
      headers: {
        "Cache-Control": "private, s-maxage=10, stale-while-revalidate=60",
        "x-ledger-status": "synced",
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "ታሪኩን መጫን አልተቻለም";
    console.error("[የመዝገብ ዝርዝር] Critical Failure:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
