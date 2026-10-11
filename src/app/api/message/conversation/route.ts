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

    // 2️⃣ Collect all channel IDs and fetch channel docs + member docs in parallel
    const memberEntries = membershipsSnap.docs.map(
      (doc) => doc.data() as ChannelMember
    );
    const channelIds = memberEntries.map((m) => m.channelId);

    // Parallel fetch: All Channel documents + All ChannelMembers for these channels
    const [channelSnaps, allMembersSnaps] = await Promise.all([
      Promise.all(
        channelIds.map((cid) =>
          adminDb.collection(COLLECTIONS.CHANNELS).doc(cid).get()
        )
      ),
      Promise.all(
        channelIds.map((cid) =>
          adminDb
            .collection(COLLECTIONS.MEMBERS)
            .where("channelId", "==", cid)
            .where("isActive", "==", true)
            .get()
        )
      ),
    ]);

    // 3️⃣ Collect ALL unique member user IDs across all channels to batch query profiles once
    const allUserIds = new Set<string>();
    allMembersSnaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const uid = d.data().userId;
        if (uid) allUserIds.add(uid);
      });
    });

    const uniqueUids = Array.from(allUserIds);

    // Batch query students & fathers in chunks of 30 (Firestore 'in' query limit)
    const profileMap = new Map<
      string,
      { fullName: string; photoUrl?: string; role: string }
    >();

    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const uidChunks = chunkArray(uniqueUids, 30);

    const [studentsChunkSnaps, fathersChunkSnaps] = await Promise.all([
      Promise.all(
        uidChunks.map((chunk) =>
          adminDb
            .collection(COLLECTIONS.STUDENTS)
            .where("uid", "in", chunk)
            .get()
        )
      ),
      Promise.all(
        uidChunks.map((chunk) =>
          adminDb
            .collection(COLLECTIONS.FATHERS)
            .where("uid", "in", chunk)
            .get()
        )
      ),
    ]);

    studentsChunkSnaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        profileMap.set(data.uid, {
          fullName: data.fullName || data.secularName || "የንስሐ ልጅ",
          photoUrl: data.photoUrl,
          role: "CHILD",
        });
      });
    });

    fathersChunkSnaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        profileMap.set(data.uid, {
          fullName: data.fullName || data.secularName || "መምህረ ንስሐ",
          photoUrl: data.photoUrl,
          role: "FATHER",
        });
      });
    });

    // 4️⃣ Read Last Messages in parallel for channels that have lastMessageId
    const lastMessagePromises = channelSnaps.map((cSnap, i) => {
      if (!cSnap.exists) return Promise.resolve(null);
      const cData = cSnap.data() as Channel;
      if (!cData.lastMessageId) return Promise.resolve(null);
      return adminDb
        .collection(COLLECTIONS.CHANNELS)
        .doc(channelIds[i])
        .collection(COLLECTIONS.MESSAGES)
        .doc(cData.lastMessageId)
        .get()
        .then((mSnap) => (mSnap.exists ? (mSnap.data() as Message) : null))
        .catch(() => null);
    });

    const lastMessages = await Promise.all(lastMessagePromises);

    // 5️⃣ Assemble summaries cleanly without serial waterfalls
    const summaries: ConversationSummary[] = [];

    for (let i = 0; i < channelSnaps.length; i++) {
      const channelSnap = channelSnaps[i];
      if (!channelSnap.exists) continue;

      const channelData = channelSnap.data() as Channel;
      const channelId = channelIds[i];
      const membersSnap = allMembersSnaps[i];
      const myMemberData = memberEntries[i];
      const lastMessage = lastMessages[i] || undefined;

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

      // Simple, fast unread calculation
      let unreadCount = 0;
      if (lastMessage && lastMessage.senderId !== session.uid) {
        const lastReadAt = myMemberData.lastReadAt || 0;
        if (lastMessage.createdAt > lastReadAt) {
          unreadCount = 1;
        }
      }

      summaries.push({
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
        unreadCount,
      });
    }

    // 6️⃣ Sort by last activity
    summaries.sort(
      (a, b) =>
        (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0)
    );

    return NextResponse.json(summaries, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("[Conversations API] Critical Failure:", err);
    return NextResponse.json(
      { error: "Sacred Ledger connection failed." },
      { status: 500 }
    );
  }
}
