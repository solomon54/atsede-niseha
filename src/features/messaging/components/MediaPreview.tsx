// src/features/messaging/components/MediaPreview.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, X } from "lucide-react";
import { FC, useCallback, useEffect, useRef, useState } from "react";

import { resolveFilename } from "./MessageBubble";

interface MediaPreviewProps {
  url: string | null;
  isOpen: boolean;
  onClose: () => void;
  mimeType?: string;
  fileName?: string;
}

export const MediaPreview: FC<MediaPreviewProps> = ({
  url,
  isOpen,
  onClose,
  mimeType = "",
  fileName = "sacred-media",
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");
  const isPdf = mimeType === "application/pdf";

  // Pause video when closing
  useEffect(() => {
    if (!isOpen && videoRef.current) videoRef.current.pause();
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  const handleDownload = useCallback(async () => {
    if (!url || isDownloading) return;
    try {
      setIsDownloading(true);
      const res = await fetch(url);
      const blob = await res.blob();
      const finalMime = mimeType || blob.type || "application/octet-stream";
      const typedBlob = new Blob([blob], { type: finalMime });
      const blobUrl = URL.createObjectURL(typedBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = resolveFilename(fileName, finalMime);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    } finally {
      setIsDownloading(false);
    }
  }, [url, fileName, mimeType, isDownloading]);

  if (!url) return null;

  // Google Docs viewer as fallback for PDFs that can't be embedded directly
  // Works for publicly accessible URLs (Cloudinary URLs are public by default)
  const pdfViewerUrl = isPdf
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/95">
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onClose}
          />

          {/* top bar */}
          <div className="relative z-[210] flex items-center justify-between
            px-4 py-3 shrink-0 border-b border-white/10">
            <p className="text-white/60 text-xs font-bold truncate max-w-[60vw]">
              {fileName}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Download file"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10
                  hover:bg-white/20 text-white rounded-full text-xs font-bold
                  transition-all disabled:opacity-50">
                {isDownloading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Download size={14} />}
                <span className="hidden sm:inline">
                  {isDownloading ? "Downloading…" : "Download"}
                </span>
              </button>
              <button
                type="button"
                aria-label="Close preview"
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full
                  text-white transition-all">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* content */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-[205] flex-1 flex items-center justify-center
              w-full min-h-0 p-4"
            onClick={(e) => e.stopPropagation()}>

            {isImage && (
              <img
                src={url}
                alt={fileName}
                draggable={false}
                className="max-w-full max-h-full object-contain rounded-xl
                  shadow-2xl select-none"
              />
            )}

            {isVideo && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-xl shadow-2xl outline-none
                  preview-video"
              />
            )}

            {isAudio && (
              <div className="flex flex-col items-center gap-5 p-8 bg-white/5
                rounded-3xl border border-white/10 w-full max-w-sm">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex
                  items-center justify-center text-4xl">
                  🎵
                </div>
                <p className="text-white font-semibold text-sm text-center
                  truncate w-full">
                  {fileName}
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={url} controls autoPlay className="w-full" />
              </div>
            )}

            {/* PDF via Google Docs viewer — works cross-origin */}
            {isPdf && pdfViewerUrl && (
              <div className="w-full h-full flex flex-col gap-2">
                <iframe
                  src={pdfViewerUrl}
                  title={fileName}
                  className="w-full flex-1 rounded-xl bg-white preview-iframe"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
                <p className="text-white/30 text-[10px] text-center">
                  Preview via Google Docs · Download for offline access
                </p>
              </div>
            )}

            {/* unsupported types */}
            {!isImage && !isVideo && !isAudio && !isPdf && (
              <div className="flex flex-col items-center gap-4 p-10 bg-white/5
                rounded-3xl border border-white/10 text-center max-w-xs">
                <span className="text-5xl">📄</span>
                <p className="text-white font-semibold text-sm">{fileName}</p>
                <p className="text-white/40 text-xs">
                  This file type cannot be previewed in the app.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white
                    rounded-2xl font-bold text-sm transition-all disabled:opacity-50">
                  {isDownloading ? "Downloading…" : "Download File"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
