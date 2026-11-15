// src/features/messaging/components/ConversationList.tsx
"use client";

import { FC, useMemo } from "react";
import { ChannelID, ConversationSummary, UID } from "../types/messaging.types";
import { ConversationItem } from "./ConversationItem";

interface Props {
  conversations: ConversationSummary[];
  activeChannelId?: ChannelID;
  onSelect: (channelId: ChannelID) => void;
  currentUserId?: UID;
}

export const ConversationList: FC<Props> = ({
  conversations,
  activeChannelId,
  onSelect,
  currentUserId,
}) => {
  if (!conversations.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <span className="text-3xl mb-3">📜</span>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          ምንም ውይይት የለም
        </p>
        <p className="text-[10px] text-slate-300 mt-1">No conversations yet</p>
      </div>
    );
  }

  // Sort list: most recent message first across all conversations
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || a.channel?.createdAt || 0;
      const timeB = b.lastMessage?.createdAt || b.channel?.createdAt || 0;
      return timeB - timeA;
    });
  }, [conversations]);

  return (
    <div className="py-2 px-1 space-y-1 w-full">
      {sortedConversations.map((c) => (
        <ConversationItem
          key={c.channel.id}
          convo={c}
          active={c.channel.id === activeChannelId}
          onSelect={() => onSelect(c.channel.id)}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
};
