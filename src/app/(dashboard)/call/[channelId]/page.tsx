// src/app/(dashboard)/call/[channelId]/page.tsx
import { redirect } from "next/navigation";

import { requireSession } from "@/core/auth/requireSession";
import LiveKitCallRoom from "@/features/calling/components/LiveKitCallRoom";
import { adminDb } from "@/services/firebase/admin";

interface CallPageProps {
  params: Promise<{ channelId: string }>;
}

export default async function CallPage({ params }: CallPageProps) {
  const session = await requireSession().catch(() => null);
  if (!session) {
    redirect("/login");
  }

  const { channelId } = await params;

  // Verify active membership in channel
  const memberSnap = await adminDb
    .collection("ChannelMembers")
    .where("channelId", "==", channelId)
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (memberSnap.empty) {
    redirect("/messages?error=unauthorized_channel");
  }

  return <LiveKitCallRoom channelId={channelId} />;
}

