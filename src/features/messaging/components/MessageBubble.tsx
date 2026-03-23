// src/features/messaging/components/MessageBubble.tsx
"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Download,
  FileText,
  Loader2,
  Music,
  Play,
  User,
} from "lucide-react";
import { FC, useEffect, useState } from "react";

import { ChannelRole, Message } from "../types/messaging.types";
import { MediaPreview } from "./MediaPreview"; // 1. Added Import

interface MessageBubbleProps {
  message: Message & { status?: "sending" | "sent" | "error" };
  isOwn: boolean;
  senderRole?: ChannelRole;
  senderName?: string;
  senderPhoto?: string;
  isDiacon?: boolean;
}

const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isOwn,
  senderRole = "CHILD",
  senderName = "የቤተሰብ አባል",
  senderPhoto,
  isDiacon = false,
}) => {
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false); // 2. Preview State

  const isUploading = message.status === "sending" && message.media;

  useEffect(() => {
    const checkLocalLedger = async () => {
      if (message.status === "sent" && !message.media?.url.startsWith("http")) {
        setIsDownloaded(true);
      }
    };
    checkLocalLedger();
  }, [message.id, message.status, message.media?.url]);

  const handleSmartDownload = async (url: string, filename: string) => {
    if (isDownloaded || isUploading) return;
    try {
      setDownloadProgress(0);
      const response = await fetch(url);
      if (!response.body) throw new Error("ReadableStream not supported");

      const reader = response.body.getReader();
      const contentLength = +(response.headers.get("Content-Length") ?? 0);

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength) {
          setDownloadProgress(
            Math.round((receivedLength / contentLength) * 100)
          );
        }
      }

      const blob = new Blob(chunks);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setIsDownloaded(true);
      setDownloadProgress(null);
    } catch (err) {
      console.error("Smart Download failed", err);
      setDownloadProgress(null);
      window.open(url, "_blank");
    }
  };

  const renderMediaContent = () => {
    if (!message.media?.url) return null;

    const isImage = message.type === "IMAGE";
    const isVideo = message.type === "VIDEO";
    const isAudio = message.type === "AUDIO";
    const isFile =
      message.type === "FILE" || (message.type as string) === "DOCUMENT";

    const fileName =
      message.media.url.split("/").pop()?.split("?")[0] || "የተቀደሰ መዝገብ";
    const sizeInBytes = message.media.sizeBytes || 0;
    const sizeFormatted =
      sizeInBytes > 1024 * 1024
        ? `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(sizeInBytes / 1024).toFixed(1)} KB`;

    return (
      <div className="relative overflow-hidden rounded-t-xl group">
        {isUploading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin mb-2" />
            <span className="text-[10px] text-white font-bold tracking-widest uppercase">
              በመጫን ላይ...
            </span>
          </div>
        )}

        {/* IMAGE RENDERER */}
        {isImage && (
          <div
            className={`relative ${
              !isUploading ? "cursor-pointer" : "cursor-default"
            }`}
            onClick={() => !isUploading && setIsPreviewOpen(true)} // 3. Open Preview
          >
            <img
              src={message.media.url}
              alt="Sacred Ledger Content"
              className={`max-h-80 w-full object-cover transition-all hover:brightness-90 ${
                isUploading ? "blur-md scale-105" : ""
              }`}
            />
            {!isUploading && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSmartDownload(message.media!.url, fileName);
                  }}
                  className={`p-2 rounded-full text-white transition-colors ${
                    isDownloaded ? "bg-green-600" : "bg-black/50 hover:bg-black"
                  }`}>
                  {isDownloaded ? <Check size={16} /> : <Download size={16} />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIDEO RENDERER */}
        {isVideo && (
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {!isUploading ? (
              <video
                src={message.media.url}
                controls
                className="w-full h-full"
              />
            ) : (
              <Play className="text-white/20 w-12 h-12" />
            )}
          </div>
        )}

        {/* AUDIO RENDERER */}
        {isAudio && (
          <div className="p-4 bg-amber-50/50 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full text-amber-600">
              <Music size={18} />
            </div>
            <audio src={message.media.url} controls className="h-8 w-full" />
          </div>
        )}

        {/* FILE / DOCUMENT RENDERER */}
        {isFile && (
          <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 relative">
                <FileText size={20} />
                {downloadProgress !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-100/90 rounded-lg">
                    <span className="text-[8px] font-black">
                      {downloadProgress}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate text-slate-700">
                  {fileName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                  {isDownloaded ? "በማስታወሻ ላይ ተቀምጧል" : sizeFormatted}
                </span>
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={() =>
                  handleSmartDownload(message.media!.url, fileName)
                }
                className={`p-2 rounded-full transition-colors ${
                  isDownloaded
                    ? "text-green-500 bg-green-50"
                    : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                }`}>
                {isDownloaded ? <Check size={18} /> : <Download size={18} />}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const roleStyles = {
    FATHER: { label: "አባታችን", color: "text-amber-600", bg: "bg-amber-50" },
    CHILD: {
      label: isDiacon ? "ዲያቆን" : "",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    READONLY: { label: "ተመልካች", color: "text-slate-400", bg: "bg-slate-50" },
  };

  const currentRole = roleStyles[senderRole as keyof typeof roleStyles] || {
    label: "",
    color: "text-slate-400",
    bg: "bg-slate-50",
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex w-full mb-4 px-1 ${
          isOwn ? "justify-end" : "justify-start"
        }`}>
        <div
          className={`flex items-end gap-2 max-w-[88%] sm:max-w-[70%] ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}>
          {!isOwn && (
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full ring-1 ring-slate-200 overflow-hidden shrink-0 mb-1">
              {senderPhoto ? (
                <img
                  src={senderPhoto}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User size={14} />
                </div>
              )}
            </div>
          )}

          <div
            className={`flex flex-col shadow-sm border ${
              isOwn
                ? "bg-slate-900 border-slate-800 text-white rounded-2xl rounded-br-none"
                : "bg-white border-slate-200 text-slate-900 rounded-2xl rounded-bl-none"
            }`}>
            {!isOwn && (
              <div className="px-3 py-1.5 flex items-center justify-between gap-6 border-b border-slate-50">
                <span className="text-[10px] font-bold text-slate-500">
                  {senderName}
                </span>
                {currentRole.label && (
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${currentRole.bg} ${currentRole.color}`}>
                    {currentRole.label}
                  </span>
                )}
              </div>
            )}

            {renderMediaContent()}

            <div className="px-3 sm:px-4 py-2 sm:py-2.5 relative">
              {message.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              )}
              <div
                className={`flex items-center gap-1.5 mt-1 ${
                  isOwn ? "justify-end" : "justify-start"
                }`}>
                <span className="text-[9px] font-medium opacity-40">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {isOwn && (
                  <div className="flex items-center">
                    {message.status === "sending" ? (
                      <Loader2
                        size={10}
                        className="animate-spin text-amber-500"
                      />
                    ) : message.status === "error" ? (
                      <AlertCircle size={12} className="text-red-500" />
                    ) : message.isRead ? (
                      <CheckCheck size={12} className="text-amber-400" />
                    ) : (
                      <Check size={12} className="text-slate-400 opacity-50" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4. Media Preview Modal (Outside motion.div for portal-like behavior) */}
      <MediaPreview
        url={message.media?.url || null}
        mimeType={message.media?.mimeType}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};

export default MessageBubble;
