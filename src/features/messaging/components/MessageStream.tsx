//src/features/messaging/components/MessageStream.tsx

"use client";

import { FC } from "react";

interface MessageStreamProps {
  channelIds: string[];
}

const MessageStream: FC<MessageStreamProps> = ({ channelIds }) => {
  if (channelIds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        No active conversation
      </div>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto bg-white">
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        Message stream coming in next phase
      </div>
    </section>
  );
};

export default MessageStream;
