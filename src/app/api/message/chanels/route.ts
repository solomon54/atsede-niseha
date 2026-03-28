// src/app/api/message/channels/route.ts
// src/app/api/message/channels/route.ts
import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { Channel } from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();

    // 1. Efficient Membership Fetch
    const membershipSnap = await adminDb
      .collection("ChannelMembers") // Note: pascal case as per your collection list
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .limit(100) // Safety limit for future-proofing
      .get();

    if (membershipSnap.empty) {
      return NextResponse.json([], {
        status: 200,
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }

    const channelIds = membershipSnap.docs.map((d) => d.data().channelId);

    // 2. Batch Fetching (Future-proof: Firebase 'in' operator is faster than Promise.all)
    // Firestore allows 'in' queries up to 30 items.
    const channelsSnap = await adminDb
      .collection("Channels")
      .where("id", "in", channelIds.slice(0, 30))
      .get();

    const channels: Channel[] = channelsSnap.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Channel)
    );

    // 3. Offline Resilience Headers
    // This tells the browser: "Use this data for 5 minutes, but revalidate in the background"
    return NextResponse.json(channels, {
      status: 200,
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("[የቤተሰብ ዝርዝር] (Channels) GET failed:", err.message);
    } else {
      console.error("[የቤተሰብ ዝርዝር] (Channels) GET failed:", err);
    }

    // Graceful Error for UI
    return NextResponse.json(
      { error: "ሰርቨሩን ማግኘት አልተቻለም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።" }, // Amharic: Could not reach server.
      { status: 500 }
    );
  }
}
