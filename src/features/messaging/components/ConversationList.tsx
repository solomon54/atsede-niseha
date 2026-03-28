// src/features/messaging/components/ConversationList.tsx
"use client";

import { FC } from "react";

import { ChannelID, ConversationSummary } from "../types/messaging.types";
import { ConversationItem } from "./ConversationItem";

interface Props {
  conversations: ConversationSummary[];
  activeChannelId?: ChannelID;
  onSelect: (channelId: ChannelID) => void;
}

export const ConversationList: FC<Props> = ({
  conversations,
  activeChannelId,
  onSelect,
}) => {
  if (!conversations.length) {
    return (
      <div className="p-4 text-sm text-slate-400">No conversations found</div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-[#fdfcf6] min-h-full">
      {conversations.map((c) => (
        <ConversationItem
          key={c.channel.id}
          convo={c}
          active={c.channel.id === activeChannelId}
          onSelect={() => onSelect(c.channel.id)}
        />
      ))}
    </div>
  );
};
