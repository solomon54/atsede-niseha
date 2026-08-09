//src/features/messaging/components/ConversationItem.tsx

"use client";

import { Lock, Users } from "lucide-react";
import Image from "next/image";

import { ConversationSummary, UID } from "../types/messaging.types";

interface Props {
  convo: ConversationSummary;
  active?: boolean;
  onSelect: (id: string) => void;
  currentUserId?: UID;
}

export function ConversationItem({ convo, active, onSelect, currentUserId }: Props) {
  const isDirect = convo.channel.type === "DIRECT";

  // For DIRECT channels, find the other participant's name
  const otherMember = isDirect && currentUserId
    ? convo.members?.find((m) => m.userId !== currentUserId)
    : null;

  const displayName = isDirect
    ? (otherMember?.fullName || convo.fullName || "ምስጢር ምክክር")
    : "የጋራ ቤት";

  const displayPhoto = isDirect
    ? (otherMember?.photoUrl || "/assets/images/qdst-bite-krstiyan.jpg")
    : "/assets/images/qdst-bite-krstiyan.jpg";

  const lastText = convo.lastMessage?.content
    ? convo.lastMessage.content.length > 40
      ? convo.lastMessage.content.slice(0, 40) + "…"
      : convo.lastMessage.content
    : convo.lastMessage?.media
    ? "📎 Media"
    : null;

  const lastTime = convo.lastMessage?.createdAt
    ? new Date(convo.lastMessage.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <button
      onClick={() => onSelect(convo.id)}
      className={`w-full text-left px-3 py-3 rounded-2xl transition-all flex items-center gap-3 ${
        active
          ? "bg-amber-50 ring-1 ring-amber-200"
          : "hover:bg-slate-50"
      }`}>

      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={`p-0.5 rounded-full ${isDirect ? "bg-gradient-to-b from-slate-300 to-slate-100" : "bg-gradient-to-b from-amber-400 to-amber-100"}`}>
          <Image
            src={displayPhoto}
            alt={displayName}
            width={40}
            height={40}
            className="rounded-full object-cover w-10 h-10"
          />
        </div>
        {/* Channel type badge */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${isDirect ? "bg-slate-700" : "bg-amber-500"}`}>
          {isDirect
            ? <Lock size={8} className="text-white" />
            : <Users size={8} className="text-white" />
          }
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm font-bold truncate ${active ? "text-amber-900" : "text-slate-900"}`}>
            {displayName}
          </p>
          {lastTime && (
            <span className="text-[9px] text-slate-400 font-bold shrink-0">{lastTime}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-[10px] text-slate-400 truncate">
            {lastText || (
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">
                {isDirect ? "Private · Direct" : "Family · Common House"}
              </span>
            )}
          </p>
          {convo.unreadCount > 0 && (
            <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
              {convo.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
