//src/features/messaging/components/ConversationItem.tsx

"use client";

import Image from "next/image";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

import { ConversationSummary } from "../types/messaging.types";

interface Props {
  convo: ConversationSummary;
  active?: boolean;
  onSelect: (id: string) => void;
}

export function ConversationItem({ convo, active, onSelect }: Props) {
  return (
    <button onClick={() => onSelect(convo.id)} className="w-full text-left">
      <SanctuarySurface
        className={`p-3 flex items-center gap-3 transition
        ${active ? "ring-1 ring-amber-400/40" : ""}`}>
        {/* Sacred Halo */}
        <div className="relative">
          <div className="p-1.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-100 shadow-xl">
            <Image
              src={convo.photoUrl ?? "/assets/images/qdst-bite-krstiyan.jpg"}
              alt=""
              width={42}
              height={42}
              className="rounded-full"
            />
          </div>
        </div>

        <div className="flex-1">
          <p className="text-slate-900 font-semibold">{convo.fullName}</p>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            {convo.role}
          </p>
        </div>
      </SanctuarySurface>
    </button>
  );
}
