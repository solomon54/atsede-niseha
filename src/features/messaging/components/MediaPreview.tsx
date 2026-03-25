// src/features/messaging/components/MediaPreview.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, Maximize2, X } from "lucide-react";
import { FC, useEffect, useState } from "react";

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
  mimeType,
  fileName = "sacred-media",
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleDownload = async () => {
    if (!url || isDownloading) return;

    try {
      setIsDownloading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed", err);
      // Fallback
      window.open(url, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!url) return null;

  const isImage = mimeType?.startsWith("image");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Close Button */}
          <button
            title="Close Preview"
            onClick={onClose}
            className="absolute top-6 right-6 z-[110] p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all">
            <X size={28} />
          </button>

          {/* Content */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="relative z-[105] max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            {isImage ? (
              <img
                src={url}
                alt="Sacred Media"
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="bg-white p-12 rounded-3xl text-center max-w-md">
                <Maximize2 size={64} className="mx-auto mb-6 text-amber-600" />
                <p className="text-lg font-medium text-slate-800 mb-2">
                  Preview not available
                </p>
                <p className="text-sm text-slate-500 mb-8">
                  This file type cannot be previewed in the app.
                </p>
              </div>
            )}

            {/* Download Button - Inside the preview */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="mt-8 flex items-center gap-3 px-8 py-3.5 bg-white hover:bg-amber-50 active:bg-amber-100 rounded-2xl text-slate-900 font-semibold shadow-lg transition-all disabled:opacity-70">
              {isDownloading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download Original
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
