//src/app/api/message/channels/route.ts

import { requireSession } from "@/core/auth/requireSession";
import { adminDb } from "@/services/firebase/admin";

export async function GET() {
  const session = await requireSession();

  const membershipSnap = await adminDb
    .collection("channelMembers")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  const channelIds = membershipSnap.docs.map((d) => d.data().channelId);

  if (!channelIds.length) {
    return Response.json([]);
  }

  const channels = await Promise.all(
    channelIds.map((id) => adminDb.collection("channels").doc(id).get())
  );

  return Response.json(channels.map((c) => ({ id: c.id, ...c.data() })));
}
