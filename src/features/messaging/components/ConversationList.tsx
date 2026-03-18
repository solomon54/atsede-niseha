//src/features/messaging/components/ConversationList.tsx
"use client";

import { useState } from "react";

import { ConversationSummary } from "../types/messaging.types";
import { ConversationItem } from "./ConversationItem";

interface Props {
  conversations: ConversationSummary[];
}

export function ConversationList({ conversations }: Props) {
  const [active, setActive] = useState<string | null>(null);

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
          active={active === c.channel.id}
          onSelect={setActive}
        />
      ))}
    </div>
  );
}
