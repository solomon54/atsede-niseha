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
  MoreVertical,
  Music,
  RefreshCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { FC, useCallback, useEffect, useRef, useState } from "react";

import { ChannelRole, Message } from "../types/messaging.types";
import { MediaPreview } from "./MediaPreview";

/* ─────────────────────────────────────────────
   MIME → extension
───────────────────────────────────────────── */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
};

export function resolveFilename(url: string, mimeType?: string, originalName?: string): string {
  // Prefer the stored original filename if available
  if (originalName) {
    if (/\.[a-zA-Z0-9]{2,5}$/.test(originalName)) return originalName;
    return originalName + (MIME_EXT[mimeType ?? ""] ?? "");
  }
  const raw = url.split("/").pop()?.split("?")[0] ?? "file";
  if (/\.[a-zA-Z0-9]{2,5}$/.test(raw)) return raw;
  return raw + (MIME_EXT[mimeType ?? ""] ?? "");
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/* ─────────────────────────────────────────────
   PROPS
───────────────────────────────────────────── */
interface MessageBubbleProps {
  message: Message & { status?: "sending" | "sent" | "error" };
  isOwn: boolean;
  senderRole?: ChannelRole;
  senderName?: string;
  senderPhoto?: string;
  isDiacon?: boolean;
  onDelete?: (messageId: string) => void;
  onCancel?: (messageId: string) => void;
  onResend?: (message: Message) => void;
}

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isOwn,
  senderRole = "CHILD",
  senderName = "የቤተሰብ አባል",
  senderPhoto,
  isDiacon = false,
  onDelete,
  onCancel,
  onResend,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ref for outside-click detection
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isSending = message.status === "sending";
  const isError = message.status === "error";

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    }
    // Use capture so it fires before anything else
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [showMenu]);

  // Close menu on scroll
  useEffect(() => {
    if (!showMenu) return;
    const handle = () => setShowMenu(false);
    window.addEventListener("scroll", handle, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handle, true);
  }, [showMenu]);

  /* ── download with correct MIME + filename ── */
  const handleDownload = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!message.media?.url || downloading) return;
      try {
        setDownloading(true);
        const res = await fetch(message.media.url);
        const blob = await res.blob();
        const mime =
          message.media.mimeType || blob.type || "application/octet-stream";
        const typedBlob = new Blob([blob], { type: mime });
        const blobUrl = URL.createObjectURL(typedBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = resolveFilename(message.media.url, mime);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        if (message.media?.url) window.open(message.media.url, "_blank");
      } finally {
        setDownloading(false);
      }
    },
    [message.media, downloading]
  );

  /* ── role badge ── */
  const roleBadge =
    senderRole === "FATHER"
      ? { text: "አባታችን", cls: "bg-amber-100 text-amber-700" }
      : isDiacon
      ? { text: "ዲያቆን", cls: "bg-blue-100 text-blue-700" }
      : null;

  /* ── context menu — shown outside bubble so overflow:hidden doesn't clip it ── */
  const ContextMenu = showMenu ? (
    <div
      ref={menuRef}
      // Portal-like: positioned relative to viewport via fixed, but we
      // approximate by using absolute on the outer wrapper (see below)
      className={`absolute z-50 min-w-[130px] bg-white rounded-xl shadow-2xl
        border border-slate-100 py-1 overflow-hidden
        ${isOwn ? "right-0" : "left-0"} top-full mt-1`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isError && onResend && (
        <button
          type="button"
          onClick={() => {
            onResend(message);
            setShowMenu(false);
          }}
          className="w-full px-3 py-2.5 text-left hover:bg-amber-50 flex items-center
            gap-2 text-[12px] text-amber-700 font-bold transition-colors">
          <RefreshCw size={12} />
          እንደገና ላክ
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            onDelete(message.id);
            setShowMenu(false);
          }}
          className="w-full px-3 py-2.5 text-left hover:bg-red-50 flex items-center
            gap-2 text-[12px] text-red-600 font-bold transition-colors">
          <Trash2 size={12} />
          ሰርዝ
        </button>
      )}
    </div>
  ) : null;

  /* ── media rendering ── */
  const renderMedia = () => {
    if (!message.media?.url) return null;
    const { url, mimeType = "", sizeBytes = 0 } = message.media;
    const isImage = message.type === "IMAGE" || mimeType.startsWith("image/");
    const isVideo = message.type === "VIDEO" || mimeType.startsWith("video/");
    const isAudio = message.type === "AUDIO" || mimeType.startsWith("audio/");
    const filename = resolveFilename(url, mimeType, message.media.originalName);

    /* uploading placeholder */
    if (isSending) {
      return (
        <div className="relative w-full min-h-[72px] flex items-center justify-center
          bg-slate-800/50 overflow-hidden">
          {isImage && (
            <img
              src={url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur opacity-30"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-1 py-3">
            <Loader2 size={18} className="animate-spin text-amber-400" />
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
              በመጫን ላይ…
            </span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(message.id)}
              title="Cancel upload"
              className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-red-600
                rounded-full text-white transition-colors">
              <X size={11} />
            </button>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div
          className="relative cursor-pointer group/img overflow-hidden"
          onClick={() => setIsPreviewOpen(true)}>
          <img
            src={url}
            alt={filename}
            loading="lazy"
            className="max-h-60 sm:max-h-72 w-full object-cover
              transition-transform duration-200 group-hover/img:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-transparent group-hover/img:bg-black/15
            transition-colors flex items-end justify-end p-2">
            <button
              type="button"
              onClick={handleDownload}
              title="Download"
              className="opacity-0 group-hover/img:opacity-100 transition-opacity
                p-1.5 bg-black/60 hover:bg-black rounded-full text-white">
              {downloading
                ? <Loader2 size={12} className="animate-spin" />
                : <Download size={12} />}
            </button>
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div
          className="relative cursor-pointer overflow-hidden bg-black"
          onClick={() => setIsPreviewOpen(true)}>
          <video
            src={url}
            preload="metadata"
            className="max-h-48 sm:max-h-56 w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90
              flex items-center justify-center shadow-lg">
              <span className="text-slate-800 font-black text-sm ml-0.5">▶</span>
            </div>
          </div>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 w-full">
          {/* tap the icon/name area to preview */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsPreviewOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setIsPreviewOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer
              hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center
              justify-center shrink-0">
              <Music size={14} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold truncate">{filename}</p>
              <p className="text-[9px] opacity-50">{formatSize(sizeBytes)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            title="Download audio"
            className="shrink-0 p-1.5 rounded-full hover:bg-black/10 transition-colors">
            {downloading
              ? <Loader2 size={12} className="animate-spin" />
              : <Download size={12} />}
          </button>
        </div>
      );
    }

    /* PDF / DOC / other — file card; tap name/icon to preview, button to download */
    return (
      <div className="flex items-center gap-2.5 px-3 py-3 w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsPreviewOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && setIsPreviewOpen(true)}
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer
            hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center
            justify-center shrink-0 text-amber-700">
            <FileText size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-bold truncate">{filename}</p>
            <p className="text-[9px] opacity-50 uppercase tracking-tight">
              {mimeType.split("/")[1]?.toUpperCase() || "FILE"} · {formatSize(sizeBytes)}
            </p>
          </div>
        </div>
        {/* download button — separate interactive element, NOT nested in button */}
        <button
          type="button"
          onClick={handleDownload}
          title="Download file"
          className="shrink-0 p-1.5 rounded-full hover:bg-black/10 transition-colors">
          {downloading
            ? <Loader2 size={12} className="animate-spin" />
            : <Download size={12} />}
        </button>
      </div>
    );
  };

  /* ── own bubble actions (shown as permanent tiny row under footer on error, hover otherwise) ── */
  const showActions = isOwn && (isError || (!isSending && (onDelete || onResend)));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className={`flex w-full mb-1 sm:mb-1.5 px-2 sm:px-3 ${
          isOwn ? "justify-end" : "justify-start"
        }`}>

        <div className={`flex items-end gap-1.5 sm:gap-2 max-w-[86%] sm:max-w-[72%] md:max-w-[60%]
          ${isOwn ? "flex-row-reverse" : "flex-row"}`}>

          {/* avatar — other person only */}
          {!isOwn && (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full ring-1 ring-slate-200
              overflow-hidden shrink-0 mb-0.5">
              {senderPhoto
                ? <img src={senderPhoto} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <User size={11} className="text-slate-400" />
                  </div>
              }
            </div>
          )}

          {/* wrapper — relative so context menu can be positioned here */}
          <div className="relative flex flex-col">

            {/* bubble */}
            <div className={`flex flex-col shadow-sm border overflow-hidden
              ${isOwn
                ? "bg-slate-900 border-slate-700 text-white rounded-2xl rounded-br-[4px]"
                : "bg-white border-slate-200 text-slate-900 rounded-2xl rounded-bl-[4px]"
              }
              ${isError ? "border-red-400/40" : ""}
            `}>

              {/* sender name — others only, non-empty */}
              {!isOwn && senderName && (
                <div className="px-2.5 sm:px-3 pt-2 pb-0.5 flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-600">
                    {senderName}
                  </span>
                  {roleBadge && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black
                      uppercase leading-none ${roleBadge.cls}`}>
                      {roleBadge.text}
                    </span>
                  )}
                </div>
              )}

              {renderMedia()}

              {message.content && (
                <p className={`px-2.5 sm:px-3 text-[13px] sm:text-sm leading-relaxed
                  whitespace-pre-wrap break-words
                  ${message.media ? "py-1.5" : "pt-2 pb-1.5"}`}>
                  {message.content}
                </p>
              )}

              {/* footer row: time + tick + three-dot */}
              <div className={`px-2.5 sm:px-3 pb-1.5 pt-0.5 flex items-center gap-1.5
                ${isOwn ? "justify-between" : "justify-end"}`}>

                {/* three-dot — only own messages, positioned INSIDE footer so
                    it's never clipped and always visible */}
                {showActions && (
                  <button
                    ref={triggerRef}
                    type="button"
                    title="Message options"
                    onClick={() => setShowMenu((v) => !v)}
                    className={`p-0.5 rounded-full transition-colors
                      ${isOwn
                        ? "text-white/40 hover:text-white/90 hover:bg-white/10"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      }`}>
                    <MoreVertical size={13} />
                  </button>
                )}

                <div className={`flex items-center gap-1 text-[9px] sm:text-[10px]
                  ${isOwn ? "opacity-50 ml-auto" : "opacity-40"}`}>
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOwn && (
                    isSending
                      ? <Loader2 size={9} className="animate-spin text-amber-400" />
                      : isError
                      ? <AlertCircle size={10} className="text-red-400" />
                      : message.isRead
                      ? <CheckCheck size={11} className="text-amber-400" />
                      : <Check size={11} />
                  )}
                </div>
              </div>
            </div>

            {/* Context menu — rendered outside bubble div so no overflow clipping */}
            {ContextMenu}
          </div>
        </div>
      </motion.div>

      <MediaPreview
        url={message.media?.url ?? null}
        mimeType={message.media?.mimeType ?? ""}
        fileName={resolveFilename(
          message.media?.url ?? "media",
          message.media?.mimeType,
          message.media?.originalName
        )}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};

export default MessageBubble;
