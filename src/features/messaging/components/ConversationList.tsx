// src/features/messaging/components/ConversationList.tsx
"use client";

import { FC } from "react";

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

  // Separate COMMON_HOUSE from DIRECT channels
  const commonHouse = conversations.filter(
    (c) => c.channel.type === "COMMON_HOUSE"
  );
  const direct = conversations.filter((c) => c.channel.type === "DIRECT");

  return (
    <div className="py-2 px-2 space-y-1">
      {/* COMMON_HOUSE group */}
      {commonHouse.length > 0 && (
        <div>
          <p className="px-2 py-2 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
            የጋራ ቤት · Family
          </p>
          {commonHouse.map((c) => (
            <ConversationItem
              key={c.channel.id}
              convo={c}
              active={c.channel.id === activeChannelId}
              onSelect={() => onSelect(c.channel.id)}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* DIRECT group */}
      {direct.length > 0 && (
        <div>
          <p className="px-2 py-2 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
            ምስጢር ምክክር · Private
          </p>
          {direct.map((c) => (
            <ConversationItem
              key={c.channel.id}
              convo={c}
              active={c.channel.id === activeChannelId}
              onSelect={() => onSelect(c.channel.id)}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
};
