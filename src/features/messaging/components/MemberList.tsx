// src/features/messaging/components/MembersList.tsx

"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { FC, useMemo, useState } from "react";

import { MemberDisplay } from "../types/messaging.types";

interface Props {
  members?: MemberDisplay[];
  currentUserId?: string;
  showPresence?: boolean;
}

const MembersList: FC<Props> = ({
  members = [],
  currentUserId,
  showPresence = false, // 🔥 default OFF (no fake presence)
}) => {
  const [query, setQuery] = useState("");

  // Normalize + sort
  const normalizedMembers = useMemo(() => {
    return members
      .filter(Boolean)
      .map((m, idx) => ({
        id: m.id ?? m.userId ?? `fallback-${idx}`,
        userId: m.userId ?? `fallback-${idx}`,
        fullName: m.fullName || m.userId || "Unknown Member",
        photoUrl: m.photoUrl || "/assets/images/qdst-bite-krstiyan.jpg",
        role: m.role ?? "MEMBER",
      }))
      .sort((a, b) => {
        if (a.role === "FATHER") return -1;
        if (b.role === "FATHER") return 1;
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [members, currentUserId]);

  // 🔍 Filter
  const filteredMembers = useMemo(() => {
    if (!query.trim()) return normalizedMembers;

    return normalizedMembers.filter((m) =>
      m.fullName.toLowerCase().includes(query.toLowerCase())
    );
  }, [normalizedMembers, query]);

  if (!normalizedMembers.length) {
    return (
      <div className="flex h-full items-center justify-center text-center px-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-700">
            No Members Loaded
          </p>
          <p className="text-xs text-slate-400">
            Conversation exists but member data is not provided.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 🔍 SEARCH */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1.5">
        {filteredMembers.map((member) => {
          const isMe = member.id === currentUserId;
          const isFather = member.role === "FATHER";

          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all
              ${
                isMe
                  ? "bg-amber-50/60"
                  : "hover:bg-slate-50 active:bg-slate-100"
              }`}>
              {/* 🔥 AVATAR WITH PREMIUM RING */}
              <div className="relative flex-shrink-0">
                <div
                  className={`p-[2px] rounded-full ${
                    isFather
                      ? "bg-gradient-to-tr from-amber-600 to-yellow-200"
                      : "bg-slate-400"
                  }`}>
                  <Image
                    src={member.photoUrl}
                    alt={member.fullName}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover bg-white"
                    unoptimized
                  />
                </div>
              </div>

              {/* INFO */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`truncate text-sm font-semibold ${
                      isMe ? "text-amber-900" : "text-slate-800"
                    }`}>
                    {member.fullName}
                  </p>

                  {isFather && (
                    <span className="text-[7px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-bold uppercase">
                      መምህረ ንሰሐ
                    </span>
                  )}

                  {isMe && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold uppercase">
                      አንተ
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 truncate">
                  {member.role.toLowerCase()}
                </p>
              </div>

              {/* 🔥 RIGHT SIDE MICRO AVATAR / STATUS */}
              <div className="shrink-0">
                {showPresence ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-200">
                    <Image
                      src={member.photoUrl}
                      alt=""
                      width={18}
                      height={18}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembersList;
