// src/app/api/message/conversations/route.ts

import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  Channel,
  ChannelID,
  ChannelMember,
  ConversationSummary,
  MemberDisplay,
  Message,
} from "@/features/messaging/types/messaging.types";
import { adminDb } from "@/services/firebase/admin";

const COLLECTIONS = {
  CHANNELS: "Channels",
  MEMBERS: "ChannelMembers",
  MESSAGES: "Messages",
  STUDENTS: "Students",
  FATHERS: "Fathers",
} as const;

/* ============================================================
   Route
============================================================ */
export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();

    // 1️⃣ Load User Memberships
    const membershipsSnap = await adminDb
      .collection(COLLECTIONS.MEMBERS)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .get();

    if (membershipsSnap.empty) {
      return NextResponse.json([], { status: 200 });
    }

    // 2️⃣ Build Conversation Summaries
    const summaries = await Promise.all(
      membershipsSnap.docs.map(async (doc) => {
        const myMemberData = doc.data() as ChannelMember;
        const channelId = myMemberData.channelId;

        // Parallel reads for channel + active members
        const [channelSnap, membersSnap] = await Promise.all([
          adminDb.collection(COLLECTIONS.CHANNELS).doc(channelId).get(),
          adminDb
            .collection(COLLECTIONS.MEMBERS)
            .where("channelId", "==", channelId)
            .where("isActive", "==", true)
            .get(),
        ]);

        if (!channelSnap.exists) return null;

        const channelData = channelSnap.data() as Channel;

        // 3️⃣ Last Message (safe optional read)
        let lastMessage: Message | undefined;
        if (channelData.lastMessageId) {
          const msgSnap = await adminDb
            .collection(COLLECTIONS.CHANNELS)
            .doc(channelId)
            .collection(COLLECTIONS.MESSAGES)
            .doc(channelData.lastMessageId)
            .get();

          if (msgSnap.exists) {
            lastMessage = msgSnap.data() as Message;
          }
        }

        // 4️⃣ Enrich Members
        const memberIds = membersSnap.docs.map((d) => d.data().userId);

        const [studentsSnap, fathersSnap] = await Promise.all([
          memberIds.length
            ? adminDb
                .collection(COLLECTIONS.STUDENTS)
                .where("uid", "in", memberIds)
                .get()
            : Promise.resolve({ docs: [] }),
          memberIds.length
            ? adminDb
                .collection(COLLECTIONS.FATHERS)
                .where("uid", "in", memberIds)
                .get()
            : Promise.resolve({ docs: [] }),
        ]);

        const profileMap = new Map<
          string,
          { fullName: string; photoUrl?: string; role: string }
        >();

        studentsSnap.docs.forEach((d) => {
          const data = d.data();
          profileMap.set(data.uid, {
            fullName: data.fullName || "የቤተሰብ አባል",
            photoUrl: data.photoUrl,
            role: "CHILD",
          });
        });

        fathersSnap.docs.forEach((d) => {
          const data = d.data();
          profileMap.set(data.uid, {
            fullName: data.fullName || "መምህር",
            photoUrl: data.photoUrl,
            role: "FATHER",
          });
        });

        const members: MemberDisplay[] = membersSnap.docs.map((d) => {
          const m = d.data() as ChannelMember;
          const profile = profileMap.get(m.userId);
          return {
            id: d.id,
            channelId: m.channelId,
            userId: m.userId,
            role: m.role ?? profile?.role ?? "CHILD",
            isActive: m.isActive ?? true,
            joinedAt: m.joinedAt ?? 0,
            fullName: profile?.fullName ?? "የቤተሰብ አባል",
            photoUrl: profile?.photoUrl,
          };
        });

        // 5️⃣ Unread Logic
        const isUnread =
          !!lastMessage &&
          (!myMemberData.lastReadAt ||
            lastMessage.createdAt > myMemberData.lastReadAt);

        // 6️⃣ Summary Projection
        const summary: ConversationSummary = {
          id: channelId as ChannelID,
          photoUrl:
            channelData.metadata?.avatarUrl ??
            "/assets/images/qdst-bite-krstiyan.jpg",
          fullName:
            channelData.metadata?.description ??
            channelData.title ??
            "Sacred Channel",
          role: channelData.type,
          channel: { ...channelData, id: channelId as ChannelID },
          members,
          lastMessage,
          unreadCount: isUnread ? 1 : 0,
        };

        return summary;
      })
    );

    // 7️⃣ Filter null
    const filtered = summaries.filter(
      (s): s is ConversationSummary => s !== null
    );

    // 8️⃣ Sort by last activity
    filtered.sort(
      (a, b) =>
        (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0)
    );

    return NextResponse.json(filtered, { status: 200 });
  } catch (err) {
    console.error("[Conversations API] Critical Failure:", err);
    return NextResponse.json(
      { error: "Sacred Ledger connection failed." },
      { status: 500 }
    );
  }
}
