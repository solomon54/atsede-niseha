// src/features/messaging/components/MessageBubble.tsx

"use client";
"use client";

import { motion } from "framer-motion";
import {
  Award,
  Check,
  CheckCheck,
  Crown,
  Loader2,
  User,
  XCircle,
} from "lucide-react";
import { FC } from "react";

import { ChannelRole, Message } from "../types/messaging.types";

// We extend the message type locally to handle our new states
interface EnrichedMessage extends Message {
  status?: "sending" | "sent" | "error";
}

interface MessageBubbleProps {
  message: EnrichedMessage;
  isOwn: boolean;
  senderRole?: ChannelRole;
  senderName?: string;
  senderPhoto?: string;
  isDiacon?: boolean;
  onCancel?: (id: string) => void; // Added for the cancel functionality
}

const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isOwn,
  senderRole = "CHILD",
  senderName = "የቤተሰብ አባል",
  senderPhoto,
  isDiacon = false,
  onCancel,
}) => {
  const getRoleConfig = (role: ChannelRole) => {
    switch (role) {
      case "FATHER":
        return {
          label: "አባታችን",
          icon: <Crown className="w-2.5 h-2.5" />,
          color: "text-amber-600",
          ring: "ring-amber-500",
        };
      case "CHILD":
        return {
          label: isDiacon ? "ዲያቆን" : "",
          icon: isDiacon ? (
            <Award className="w-2.5 h-2.5" />
          ) : (
            <User className="w-2.5 h-2.5" />
          ),
          color: isDiacon ? "text-blue-600" : "text-slate-500",
          ring: isDiacon ? "ring-blue-400" : "ring-slate-300",
        };
      default:
        return {
          label: "",
          icon: <User className="w-2.5 h-2.5" />,
          color: "text-slate-400",
          ring: "ring-slate-200",
        };
    }
  };

  const role = getRoleConfig(senderRole);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`flex w-full mb-5 px-2 sm:px-4 ${
        isOwn ? "justify-end" : "justify-start"
      }`}>
      <div
        className={`flex items-end gap-2.5 max-w-[95%] sm:max-w-[85%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}>
        {/* Profile Anchor */}
        {!isOwn && (
          <div className="relative flex-shrink-0 mb-1">
            <div
              className={`h-9 w-9 rounded-full ring-2 ${role.ring} ring-offset-2 overflow-hidden bg-white shadow-md`}>
              {senderPhoto ? (
                <img
                  src={senderPhoto}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-slate-800 text-slate-400">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* The Ledger Box */}
        <div
          className={`flex flex-col shadow-xl overflow-hidden border transition-all ${
            isOwn
              ? "bg-slate-800 border-slate-700 text-white rounded-[1.4rem] rounded-br-none"
              : "bg-white border-slate-200 text-slate-900 rounded-[1.4rem] rounded-bl-none"
          }`}>
          {/* Identity Header: Subtle Boundary */}
          {!isOwn && (
            <div className="px-4 py-2 flex items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100/50">
              <span className="text-[10px] font-black tracking-tight text-slate-600 truncate">
                {senderName}
              </span>
              {role.label && (
                <span
                  className={`text-[7px] font-black uppercase tracking-widest ${role.color}`}>
                  {role.label}
                </span>
              )}
            </div>
          )}

          {/* Message Content */}
          <div className="px-4 py-3 sm:px-5 relative">
            <p className="text-[13px] sm:text-[14px] leading-relaxed font-medium">
              {message.content}
            </p>

            {/* Meta: Time + Status Logic */}
            <div
              className={`flex items-center gap-1.5 mt-2 ${
                isOwn ? "justify-end" : "justify-start"
              }`}>
              <span className="text-[8px] font-bold opacity-40 uppercase">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {isOwn && (
                <div className="flex items-center">
                  {message.status === "sending" ? (
                    // CANCELLABLE SPINNER
                    <button
                      onClick={() => onCancel?.(message.id)}
                      className="group relative flex items-center justify-center"
                      title="Cancel sending">
                      <Loader2 className="w-3 h-3 text-amber-500 animate-spin group-hover:opacity-0" />
                      <XCircle className="w-3 h-3 text-red-400 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ) : message.isRead ? (
                    <CheckCheck className="w-3.5 h-3.5 text-amber-400 stroke-[3px]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-slate-400 stroke-[3px]" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
