//sre/features/messaging/components/MediaPreview.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Maximize2, X } from "lucide-react";
import { FC, useEffect } from "react";

interface MediaPreviewProps {
  url: string | null;
  isOpen: boolean;
  onClose: () => void;
  mimeType?: string;
}

export const MediaPreview: FC<MediaPreviewProps> = ({
  url,
  isOpen,
  onClose,
  mimeType,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!url) return null;

  const isImage = mimeType?.startsWith("image");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />

          {/* Close Button */}
          <button
            title="Close Preview"
            onClick={onClose}
            className="absolute top-6 right-6 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
            <X size={24} />
          </button>

          {/* Content Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-[105] max-w-5xl w-full max-h-full flex items-center justify-center">
            {isImage ? (
              <img
                src={url}
                alt="Sacred Media"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                <Maximize2 size={48} className="text-amber-600 mb-4" />
                <p className="text-slate-900 font-bold">
                  Preview not available for this file type
                </p>
                <a
                  href={url}
                  target="_blank"
                  className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-full text-sm">
                  Open in New Tab
                </a>
              </div>
            )}

            {/* Metadata overlay at bottom */}
            <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-4">
              <button
                onClick={() => window.open(url, "_blank")}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs font-bold transition-all">
                <Download size={14} /> Download Original
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
