// mobile/src/lib/channel-helper.ts
import { Alert } from "react-native";
import { apiRequest } from "./api";
import { copyToClipboard } from "./clipboard";

export interface ConversationMember {
  userId: string;
  fullName?: string;
  role?: string;
  photoUrl?: string;
}

export interface ConversationItem {
  id: string;
  role: "DIRECT" | "COMMON_HOUSE";
  members?: ConversationMember[];
  fullName?: string;
}

/**
 * Resolves the DIRECT channel ID between the current father and a specific child.
 * If the channel is not yet provisioned, calls the idempotent /api/message/repair-channels
 * and re-queries.
 */
export async function resolveChildDirectChannel(child: {
  uid?: string;
  eotcUid?: string;
  accountClaimed?: boolean;
}): Promise<string | null> {
  // If child is not claimed or has no Auth UID, a DIRECT channel cannot exist yet
  if (!child.accountClaimed || !child.uid) {
    return null;
  }

  try {
    // 1. Fetch conversations
    const convs = await apiRequest<ConversationItem[]>("/api/message/conversation");
    if (Array.isArray(convs)) {
      const match = convs.find(
        (c) =>
          c.role === "DIRECT" &&
          c.members?.some((m) => m.userId === child.uid)
      );
      if (match?.id) {
        return match.id;
      }
    }

    // 2. Fallback: repair channels to ensure DIRECT channel is created
    await apiRequest("/api/message/repair-channels", { method: "POST" }).catch(() => {});

    // 3. Re-query conversations after repair
    const refreshed = await apiRequest<ConversationItem[]>("/api/message/conversation");
    if (Array.isArray(refreshed)) {
      const match = refreshed.find(
        (c) =>
          c.role === "DIRECT" &&
          c.members?.some((m) => m.userId === child.uid)
      );
      if (match?.id) {
        return match.id;
      }
    }
  } catch (err) {
    console.warn("[resolveChildDirectChannel] Error resolving channel:", err);
  }

  return null;
}

/**
 * Gracefully informs the father if a child has not claimed their account yet.
 * Offers to copy the EOTC ID or call the child directly.
 */
export function showUnclaimedAccountNotice(child: {
  secularName?: string;
  fullName?: string;
  eotcUid: string;
  phone?: string;
}) {
  const childName = child.secularName || child.fullName || "ልጁ";
  const buttons: any[] = [
    {
      text: "የቃል ኪዳን ቁጥር ቅዳ",
      onPress: () => copyToClipboard(child.eotcUid, "የቃል ኪዳን መለያ ቁጥር"),
    },
    {
      text: "እሺ",
      style: "cancel",
    },
  ];

  Alert.alert(
    "መለያው ገና አልተረጋገጠም (PENDING)",
    `${childName} እስካሁን የቃል ኪዳን መለያ ቁጥሩን (${child.eotcUid}) ተጠቅሞ መለያውን አላረጋገጠም። የቪዲዮ ጥሪ፣ ቀጥታ መልዕክት እና ቀጠሮ የሚቻለው ልጁ መለያውን ሲያረጋግጥ (Claim ሲያደርግ) ብቻ ነው።\n\nእባክዎ መለያ ቁጥሩን ለልጁ በማጋራት እንዲገባ ያድርጉ።`,
    buttons
  );
}
