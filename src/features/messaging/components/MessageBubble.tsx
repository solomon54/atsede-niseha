// src/features/messaging/components/MessageBubble.tsx
"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Lock,
  MoreVertical,
  Music,
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Play,
  RefreshCw,
  Trash2,
  User,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatEthiopianTimeShort } from "@/shared/utils/calendar/ethiopianCalendar";

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

function formatSec(sec?: number | null): string {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  currentUserRole?: ChannelRole;
  currentUserName?: string;
  onDelete?: (messageId: string) => void;
  onCancel?: (messageId: string) => void;
  onResend?: (message: Message) => void;
}

interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  url: string;
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
  currentUserRole,
  currentUserName,
  onDelete,
  onCancel,
  onResend,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // In-app browser sheet state
  const [inAppBrowserUrl, setInAppBrowserUrl] = useState<string | null>(null);

  // Link preview state
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);

  // Audio player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isSending = message.status === "sending";
  const isError = message.status === "error";
  const isDeleted = Boolean(message.deletedAt);

  // Extract public HTTPS link from message content
  const detectedUrl = useMemo(() => {
    if (!message.content || isDeleted) return null;
    const match = message.content.match(/https:\/\/[^\s]+/i);
    return match ? match[0] : null;
  }, [message.content, isDeleted]);

  // Fetch server-side link preview safely
  useEffect(() => {
    if (!detectedUrl) {
      setLinkPreview(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/message/link-preview?url=${encodeURIComponent(detectedUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.success) {
          setLinkPreview(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [detectedUrl]);

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
        const mime = message.media.mimeType || blob.type || "application/octet-stream";
        const typedBlob = new Blob([blob], { type: mime });
        const blobUrl = URL.createObjectURL(typedBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = resolveFilename(message.media.url, mime, message.media.originalName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setIsDownloaded(true);
      } catch {
        if (message.media?.url) {
          setIsPreviewOpen(true);
        }
      } finally {
        setDownloading(false);
      }
    },
    [message.media, downloading]
  );

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  /* ── initial for avatar fallback ── */
  const senderInitial = useMemo(() => {
    const clean = senderName.replace(/^(ቀሲስ|ዲያቆን|መምህር|ሊቀ)\s+/i, "");
    return clean.charAt(0) || "✞";
  }, [senderName]);

  /* ── role badge ── */
  const roleBadge =
    senderRole === "FATHER"
      ? { text: "አባታችን", cls: "bg-amber-100 text-amber-700 font-bold" }
      : isDiacon
      ? { text: "ዲያቆን", cls: "bg-blue-100 text-blue-700 font-bold" }
      : null;

  /* ── context menu ── */
  const ContextMenu = showMenu ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        e.stopPropagation();
        setShowMenu(false);
      }}
    >
      <div
        ref={menuRef}
        className="w-full max-w-[280px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">
            አማራጮች
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            className="p-1 -mr-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="py-1">
          {/* Copy Text Option */}
          {message.content && !isDeleted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (message.content) {
                  navigator.clipboard.writeText(message.content);
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 2000);
                }
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-[13px] text-slate-700 font-bold transition-colors"
            >
              <Copy size={15} />
              ጽሑፉን ቅዳ (Copy)
            </button>
          )}

          {isSending && onCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(message.id);
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-3 text-[13px] text-orange-600 font-bold transition-colors"
            >
              <X size={15} />
              መላክ ሰርዝ (Cancel)
            </button>
          )}

          {isError && onResend && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResend(message);
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-amber-50 flex items-center gap-3 text-[13px] text-amber-700 font-bold transition-colors"
            >
              <RefreshCw size={15} />
              እንደገና ሞክር (Retry)
            </button>
          )}

          {onDelete && !isSending && !isDeleted && (
            confirmDelete ? (
              <div className="px-4 py-4 bg-red-50">
                <p className="text-[13px] text-red-700 font-bold mb-3 text-center">
                  ይህንን መልዕክት መሰረዝ ይፈልጋሉ?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(message.id);
                      setShowMenu(false);
                      setConfirmDelete(false);
                    }}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 transition-colors text-white rounded-xl text-[12px] font-bold"
                  >
                    አዎ፣ ይሰረዝ
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(false);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors rounded-xl text-[12px] font-bold"
                  >
                    ተው
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-[13px] text-red-600 font-bold transition-colors"
              >
                <Trash2 size={15} />
                መልዕክቱን ሰርዝ (Delete)
              </button>
            )
          )}
        </div>
      </div>
    </div>
  ) : null;

  /* ── call message rendering ── */
  if (message.type === "CALL" || message.callDetails) {
    const cd = message.callDetails;
    const isMissed = cd?.status === "missed";
    const isDeclined = cd?.status === "declined";
    const isCancelled = cd?.status === "cancelled";
    const isAnswered = cd?.status === "answered";
    const isCallerMissed = isMissed || (isCancelled && !isOwn);

    const title = cd?.isGroup ? "የጋራ ቤት የቪዲዮ ጥሪ" : "የቪዲዮ ጥሪ";
    let subtitle = "ጥሪ";

    if (isAnswered) {
      subtitle = cd?.durationSec ? `የተመለሰ (${formatSec(cd.durationSec)})` : "የተመለሰ";
    } else if (isMissed) {
      subtitle = isOwn ? "ያልተመለሰ ጥሪ" : "ያመለጠ ጥሪ";
    } else if (isDeclined) {
      subtitle = "የተዘጋ ጥሪ";
    } else if (isCancelled) {
      subtitle = isOwn ? "የተሰረዘ ጥሪ" : "ያመለጠ ጥሪ";
    }

    return (
      <div className="flex w-full my-2 justify-center">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/70 shadow-md backdrop-blur-md max-w-sm">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isCallerMissed
                ? "bg-red-500/20 text-red-400"
                : isDeclined || isCancelled
                ? "bg-slate-700/40 text-slate-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {isCallerMissed ? (
              <PhoneMissed size={18} />
            ) : isDeclined || isCancelled ? (
              <PhoneOff size={18} />
            ) : (
              <Video size={18} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{title}</p>
            <p
              className={`text-[11px] font-medium ${
                isCallerMissed ? "text-red-400" : "text-slate-300"
              }`}
            >
              {subtitle} · {formatEthiopianTimeShort(message.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (message.channelId) {
                window.location.href = `/call/${message.channelId}`;
              }
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded-full text-xs font-bold text-white shadow transition-transform active:scale-95 shrink-0 flex items-center gap-1"
          >
            ደውል
          </button>
        </div>
      </div>
    );
  }

  /* ── media rendering ── */
  const renderMedia = () => {
    if (!message.media?.url || isDeleted) return null;
    const { url, mimeType = "", sizeBytes = 0 } = message.media;
    const isImage = message.type === "IMAGE" || mimeType.startsWith("image/");
    const isVideo = message.type === "VIDEO" || mimeType.startsWith("video/");
    const isAudio = message.type === "AUDIO" || mimeType.startsWith("audio/");
    const isPdf = mimeType === "application/pdf" || url.toLowerCase().endsWith(".pdf");
    const filename = resolveFilename(url, mimeType, message.media.originalName);

    if (isSending) {
      return (
        <div className="relative w-full min-h-[72px] flex items-center justify-center bg-slate-800/50 overflow-hidden">
          <div className="relative z-10 flex flex-col items-center gap-1 py-3">
            <Loader2 size={18} className="animate-spin text-amber-400" />
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
              በመጫን ላይ…
            </span>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div
          className="relative cursor-pointer group/img overflow-hidden"
          onClick={() => setIsPreviewOpen(true)}
        >
          <img
            src={url}
            alt={filename}
            loading="lazy"
            className="max-h-60 sm:max-h-72 w-full object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
          />
        </div>
      );
    }

    if (isVideo) {
      return (
        <div
          className="relative cursor-pointer overflow-hidden bg-black"
          onClick={() => setIsPreviewOpen(true)}
        >
          <video
            src={url}
            preload="metadata"
            className="max-h-48 sm:max-h-56 w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play size={18} className="text-slate-900 ml-0.5 fill-slate-900" />
            </div>
          </div>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex items-center gap-3 px-3 py-2.5 w-full min-w-[220px]">
          <audio
            ref={audioRef}
            src={url}
            preload="metadata"
            onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
            onTimeUpdate={() => setAudioCurrentTime(audioRef.current?.currentTime || 0)}
            onEnded={() => setIsPlayingAudio(false)}
          />
          <button
            type="button"
            onClick={toggleAudio}
            className="w-9 h-9 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shrink-0 shadow transition-transform active:scale-95"
          >
            {isPlayingAudio ? (
              <Pause size={15} />
            ) : (
              <Play size={15} className="ml-0.5 fill-white" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-bold truncate">{filename}</p>
            <div className="flex items-center justify-between text-[10px] opacity-60 mt-1">
              <span>{formatSec(audioCurrentTime)}</span>
              <span>{formatSec(audioDuration || message.media.durationSeconds || 0)}</span>
            </div>
          </div>
        </div>
      );
    }

    // PDF or any other file
    return (
      <div className="flex items-center gap-2.5 px-3 py-3 w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => (isPdf ? setIsPreviewOpen(true) : handleDownload())}
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-bold truncate">{filename}</p>
            <p className="text-[9px] opacity-60 uppercase tracking-tight">
              {isPdf ? "PDF" : mimeType.split("/")[1]?.toUpperCase() || "FILE"} · {formatSize(sizeBytes)}
            </p>
          </div>
        </div>

        {/* Download State: Spinner if downloading, Checkmark if downloaded, Download icon if not */}
        <button
          type="button"
          onClick={handleDownload}
          title={isDownloaded ? "Downloaded" : "Download file"}
          className="shrink-0 p-1.5 rounded-full hover:bg-black/10 transition-colors"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin text-amber-500" />
          ) : isDownloaded ? (
            <Check size={14} className="text-emerald-500" />
          ) : (
            <Download size={14} />
          )}
        </button>
      </div>
    );
  };

  /* ── link preview card inside bubble ── */
  const renderLinkPreview = () => {
    if (!linkPreview || isDeleted) return null;

    return (
      <div
        onClick={() => setInAppBrowserUrl(linkPreview.url)}
        className="mx-2 mb-2 rounded-xl overflow-hidden border border-amber-500/20 bg-black/20 hover:bg-black/30 cursor-pointer transition-all"
      >
        {linkPreview.image && (
          <img
            src={linkPreview.image}
            alt={linkPreview.title || linkPreview.domain}
            className="w-full h-28 object-cover"
          />
        )}
        <div className="p-2.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Globe size={10} />
            <span>{linkPreview.domain}</span>
          </div>
          <p className="text-xs font-bold leading-tight truncate text-white">
            {linkPreview.title}
          </p>
          {linkPreview.description && (
            <p className="text-[10px] text-slate-300 opacity-80 line-clamp-1 mt-0.5">
              {linkPreview.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  /* ── deleted message rendering ── */
  const renderDeleted = () => (
    <div className="px-3 py-2.5 flex items-center gap-2 text-xs italic text-slate-400 opacity-70">
      <XCircle size={14} className="shrink-0 text-slate-400" />
      <span>ይህ መልዕክት ተሰርዟል (Message deleted)</span>
    </div>
  );

  /* ── reply quote header ── */
  const renderReplyQuote = () => {
    if (!message.replyTo || isDeleted) return null;

    return (
      <div
        className={`mx-2.5 mt-2 mb-1 p-2 rounded-lg border-l-3 flex flex-col ${
          isOwn
            ? "bg-white/10 border-amber-400 text-white"
            : "bg-slate-100 border-amber-600 text-slate-800"
        }`}
      >
        <span className="text-[10px] font-bold text-amber-500 truncate">
          {message.replyTo.senderName}
        </span>
        <span className="text-[11px] opacity-80 truncate line-clamp-1">
          {message.replyTo.contentSnippet}
        </span>
      </div>
    );
  };

  const showActions = isOwn && (isError || isSending || (!isSending && (onDelete || onResend)));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className={`flex w-full mb-1 sm:mb-1.5 px-2 sm:px-3 ${
          isOwn ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`flex items-end gap-1.5 sm:gap-2 max-w-[80%] ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Avatar for the other person: Photo or Initial */}
          {!isOwn && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-1 ring-slate-200 overflow-hidden shrink-0 mb-0.5 flex items-center justify-center bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 text-white font-bold text-xs shadow-xs">
              {senderPhoto ? (
                <img src={senderPhoto} alt={senderName} className="w-full h-full object-cover" />
              ) : (
                <span>{senderInitial}</span>
              )}
            </div>
          )}

          {/* Bubble Container: Mine dark, Theirs light, max 80% */}
          <div className="relative flex flex-col max-w-full">
            <div
              className={`flex flex-col shadow-sm border overflow-hidden max-w-full break-words ${
                isOwn
                  ? "bg-slate-900 border-slate-700 text-white rounded-2xl rounded-br-[4px]"
                  : "bg-white border-slate-200 text-slate-900 rounded-2xl rounded-bl-[4px]"
              } ${isError ? "border-red-400/40" : ""}`}
            >
              {/* Sender Name + Role Badge (Theirs) */}
              {!isOwn && senderName && !isDeleted && (
                <div className="px-2.5 sm:px-3 pt-2 pb-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700 truncate">
                    {senderName}
                  </span>
                  {roleBadge && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${roleBadge.cls}`}>
                      {roleBadge.text}
                    </span>
                  )}
                </div>
              )}

              {/* Reply Quote Header */}
              {renderReplyQuote()}

              {/* Deleted Message */}
              {isDeleted ? (
                renderDeleted()
              ) : (
                <>
                  {renderMedia()}

                  {message.content && (
                    <p
                      className={`px-2.5 sm:px-3 text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        message.media ? "py-1.5" : "pt-2 pb-1"
                      }`}
                    >
                      {message.content}
                    </p>
                  )}

                  {renderLinkPreview()}
                </>
              )}

              {/* Footer: Time + Ticks inside the bubble */}
              <div
                className={`px-2.5 sm:px-3 pb-1.5 pt-0.5 flex items-center gap-1.5 ${
                  isOwn ? "justify-between" : "justify-end"
                }`}
              >
                {showActions && (
                  <button
                    ref={triggerRef}
                    type="button"
                    title="Message options"
                    onClick={() => setShowMenu((v) => !v)}
                    className={`p-0.5 rounded-full transition-colors ${
                      isOwn
                        ? "text-white/40 hover:text-white/90 hover:bg-white/10"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <MoreVertical size={13} />
                  </button>
                )}

                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <span
                    className={`text-[9px] ${
                      isOwn ? "text-white/50" : "text-slate-400"
                    }`}
                  >
                    {formatEthiopianTimeShort(message.createdAt)}
                  </span>

                  {isOwn && (
                    <span className="inline-flex items-center">
                      {isSending ? (
                        <Loader2 size={10} className="animate-spin text-white/40" />
                      ) : isError ? (
                        <AlertCircle size={10} className="text-red-400" />
                      ) : message.isRead ? (
                        <CheckCheck size={11} className="text-amber-400" />
                      ) : (
                        <Check size={11} className="text-white/40" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Context Menu Modal */}
      {ContextMenu}

      {/* In-App Media Preview Full Screen Modal */}
      <MediaPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        url={message.media?.url || null}
        mimeType={message.media?.mimeType}
        fileName={resolveFilename(
          message.media?.url || "",
          message.media?.mimeType,
          message.media?.originalName
        )}
      />

      {/* In-App Browser Sheet Modal for safe Link Viewing */}
      {inAppBrowserUrl && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/90 text-white">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <Lock size={13} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-bold truncate text-slate-200">
                {inAppBrowserUrl}
              </span>
            </div>
            <button
              onClick={() => setInAppBrowserUrl(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Close browser sheet"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 w-full bg-white">
            <iframe
              src={inAppBrowserUrl}
              title="In-app browser"
              sandbox="allow-same-origin allow-scripts allow-forms"
              className="w-full h-full border-none"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MessageBubble;
