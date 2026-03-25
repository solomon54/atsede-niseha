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
} as const;

export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();

    // 1. Get current user's active memberships
    const userMembershipsSnap = await adminDb
      .collection(COLLECTIONS.MEMBERS)
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .get();

    if (userMembershipsSnap.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const summaryPromises = userMembershipsSnap.docs.map(async (doc) => {
      // Use "as ChannelMember" once to define the schema from Firestore
      const myMemberData = doc.data() as ChannelMember;
      const channelId = myMemberData.channelId;

      // Parallel fetch for Channel metadata and ALL members of this channel
      const [channelSnap, allMembersSnap] = await Promise.all([
        adminDb.collection(COLLECTIONS.CHANNELS).doc(channelId).get(),
        adminDb
          .collection(COLLECTIONS.MEMBERS)
          .where("channelId", "==", channelId)
          .where("isActive", "==", true)
          .get(),
      ]);

      if (!channelSnap.exists) return null;
      const channelData = channelSnap.data() as Channel;

      let lastMessage: Message | undefined = undefined;
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

      /**
       * 2. Correct Member Fetching
       * We map all members. Since 'fullName' and 'photoUrl' are in MemberDisplay
       * but not the base ChannelMember, we treat the firestore data as MemberDisplay
       * to safely access those optional fields.
       */
      const members: MemberDisplay[] = allMembersSnap.docs.map((mDoc) => {
        const m = mDoc.data() as MemberDisplay;
        return {
          ...m,
          id: mDoc.id, // Ensure document ID is preserved
          fullName: m.fullName || "የቤተሰብ አባል",
          photoUrl: m.photoUrl,
        };
      });

      // 3. Unread Logic (Resilient comparison)
      const isUnread = !!(
        lastMessage &&
        (!myMemberData.lastReadAt ||
          lastMessage.createdAt > myMemberData.lastReadAt)
      );

      // 4. Construct Summary based on ConversationSummary interface
      const summary: ConversationSummary = {
        id: channelId,
        // Using ChannelMetadata as defined in your types
        photoUrl:
          channelData.metadata?.avatarUrl ||
          "/assets/images/qdst-bite-krstiyan.jpg",
        fullName:
          channelData.metadata?.description ||
          channelData.title ||
          "Sacred Channel",
        role: channelData.type, // Map ChannelType to the role string required by UI
        channel: { ...channelData, id: channelId },
        members,
        lastMessage,
        unreadCount: isUnread ? 1 : 0,
      };

      return summary;
    });

    const results = await Promise.all(summaryPromises);
    const summaries = results.filter(
      (s): s is ConversationSummary => s !== null
    );

    // Sort by most recent activity
    summaries.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || 0;
      const timeB = b.lastMessage?.createdAt || 0;
      return timeB - timeA;
    });

    return NextResponse.json(summaries, { status: 200 });
  } catch (err) {
    console.error("[Conversations API] Critical Failure:", err);
    return NextResponse.json(
      { error: "Sacred Ledger connection failed." },
      { status: 500 }
    );
  }
}
