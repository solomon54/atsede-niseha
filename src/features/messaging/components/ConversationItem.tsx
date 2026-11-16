// src/features/messaging/components/ConversationItem.tsx
"use client";

import { useMemo } from "react";
import Image from "next/image";
import { formatEthiopianTimeShort } from "@/shared/utils/calendar/ethiopianCalendar";
import { ConversationSummary, UID } from "../types/messaging.types";

interface Props {
  convo: ConversationSummary;
  active?: boolean;
  onSelect: (id: string) => void;
  currentUserId?: UID;
}

export function ConversationItem({ convo, active, onSelect, currentUserId }: Props) {
  const isDirect = convo.channel.type === "DIRECT";
  const hasUnread = (convo.unreadCount || 0) > 0;

  // For DIRECT channels, resolve the other member
  const otherMember = isDirect && currentUserId
    ? convo.members?.find((m) => m.userId !== currentUserId)
    : null;

  const displayName = isDirect
    ? (otherMember?.fullName || convo.fullName || "የግል መልዕክት")
    : (convo.channel.title || "የጋራ ቤት");

  const displayPhoto = isDirect
    ? otherMember?.photoUrl || null
    : null;

  const initial = useMemo(() => {
    const clean = displayName.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
    return clean.charAt(0) || "✞";
  }, [displayName]);

  // Compute clean one-line last message representation
  const lastLine = useMemo(() => {
    const lm = convo.lastMessage;
    if (!lm) {
      return isDirect ? "የግል መልዕክት" : "የጋራ ቤት ውይይት";
    }

    let messageText = "";

    if (lm.type === "CALL") {
      messageText = "📞 የቪዲዮ ጥሪ";
    } else if (lm.type === "IMAGE" || lm.media?.mimeType?.startsWith("image/")) {
      messageText = "📷 Photo";
    } else if (lm.type === "VIDEO" || lm.media?.mimeType?.startsWith("video/")) {
      messageText = "🎥 Video";
    } else if (lm.type === "AUDIO" || lm.media?.mimeType?.startsWith("audio/")) {
      messageText = "🎵 Audio";
    } else if (lm.type === "FILE" || lm.media?.url) {
      const fname = lm.media?.originalName || "ፋይል";
      messageText = `📎 ${fname}`;
    } else if (lm.isEncrypted) {
      // Never expose ciphertext in previews. Show decrypted preview only if explicitly available.
      const decrypted = (lm as any).decryptedPreview?.trim?.() || "";
      messageText = decrypted || "አዲስ መልዕክት";
    } else if ((lm as any).decryptionFailed) {
      messageText = "⚠️ መልዕክቱን መክፈት አልተቻለም";
    } else {
      messageText = lm.content?.trim() || "መልእክት";
    }

    // In a group, prefix with the sender's first name
    if (!isDirect && lm.senderId) {
      let senderName = "";
      if (lm.senderId === currentUserId) {
        senderName = "እርስዎ";
      } else {
        const member = convo.members?.find((m) => m.userId === lm.senderId);
        const rawName = member?.fullName || "";
        senderName = rawName.split(" ")[0] || "ተሳታፊ";
      }
      return `${senderName}: ${messageText}`;
    }

    return messageText;
  }, [convo.lastMessage, isDirect, currentUserId, convo.members]);

  const lastTime = convo.lastMessage?.createdAt
    ? formatEthiopianTimeShort(convo.lastMessage.createdAt)
    : null;

  return (
    <button
      onClick={() => onSelect(convo.id)}
      className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 border ${
        active
          ? "bg-amber-50/90 border-amber-300 ring-1 ring-amber-300"
          : hasUnread
          ? "bg-white border-amber-200/80 hover:bg-amber-50/40 shadow-xs"
          : "bg-transparent border-transparent hover:bg-slate-100/70"
      }`}
    >
      {/* Circle Avatar (Photo if available, otherwise Initial) */}
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 text-white font-bold text-base shadow-sm">
          {displayPhoto ? (
            <Image
              src={displayPhoto}
              alt={displayName}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
      </div>

      {/* Message Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p
            className={`text-sm truncate ${
              hasUnread || active
                ? "font-extrabold text-slate-900"
                : "font-semibold text-slate-800"
            }`}
          >
            {displayName}
          </p>
          {lastTime && (
            <span
              className={`text-[10px] shrink-0 font-medium ${
                hasUnread ? "text-amber-700 font-bold" : "text-slate-400"
              }`}
            >
              {lastTime}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p
            className={`text-xs truncate ${
              hasUnread
                ? "font-bold text-slate-900"
                : "text-slate-500 font-normal"
            }`}
          >
            {lastLine}
          </p>

          {/* Unread Count Badge ONLY when unreadCount > 0 */}
          {hasUnread && (
            <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
              {convo.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
