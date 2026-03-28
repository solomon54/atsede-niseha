// src/features/messaging/components/Composer.tsx
/**
 * EOTC Sacred Ledger — Production Grade Composer (v1.1)
 * ============================================================
 * Features:
 * - Strict Zero-Any via OptimisticMessage type
 * - Mobile-First (<320px) optimized layout
 * - Clean spacious layout like the second screenshot
 * - Icons never clutter even on tiny screens
 * - Resilience: Text restoration on failure
 */

"use client";

import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Paperclip,
  Send,
  Video,
  X,
} from "lucide-react";
import { ChangeEvent, FC, useEffect, useRef, useState } from "react";

import { useSendMessage } from "../hooks/useSendMessage";
import { MEDIA_LIMITS } from "../services/mediaPolicy";
import { ChannelID, Message, MessageType, UID } from "../types/messaging.types";

/**
 * Strict structure for optimistic UI updates
 */
export type OptimisticMessage = Omit<
  Message,
  "id" | "isRead" | "version" | "isEncrypted"
>;

interface ComposerProps {
  channelId: ChannelID;
  currentUserId: UID;
  encryptionKeyId?: string;
  disabled?: boolean;
  onOptimisticSend?: (message: OptimisticMessage) => void;
}

const Composer: FC<ComposerProps> = ({
  channelId,
  currentUserId,
  encryptionKeyId,
  disabled = false,
  onOptimisticSend,
}) => {
  const [value, setValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, isSending } = useSendMessage(currentUserId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow logic
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${Math.min(
        textAreaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [value]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MEDIA_LIMITS.MAX_FILE_SIZE) {
      setError(
        `ፋይሉ በጣም ትልቅ ነው (Max ${MEDIA_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB)`
      );
      return;
    }

    if (!MEDIA_LIMITS.ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("ይህ የፋይል አይነት አይፈቀድም።");
      return;
    }

    setError(null);
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    const rawContent = value.trim();
    if ((!rawContent && !selectedFile) || isSending || disabled) return;

    const textToSend = value;
    const fileToSend = selectedFile;
    const currentPreview = previewUrl;

    setValue("");
    clearFile();

    try {
      let type: MessageType = "TEXT";
      if (fileToSend) {
        if (fileToSend.type.startsWith("image/")) type = "IMAGE";
        else if (fileToSend.type.startsWith("audio/")) type = "AUDIO";
        else if (fileToSend.type.startsWith("video/")) type = "VIDEO";
        else type = "FILE";
      }

      if (onOptimisticSend) {
        onOptimisticSend({
          content: textToSend,
          type,
          channelId,
          senderId: currentUserId,
          createdAt: Date.now(),
          media: fileToSend
            ? {
                url: currentPreview || "",
                mimeType: fileToSend.type,
                sizeBytes: fileToSend.size,
              }
            : null,
        });
      }

      await sendMessage({
        channelId,
        content: textToSend,
        type,
        file: fileToSend || undefined,
        isEncrypted: !!encryptionKeyId,
      });
    } catch (err: unknown) {
      setValue(textToSend);
      setError("Failed to transmit. Try again.");
    }
  };

  const getFileIcon = () => {
    if (!selectedFile)
      return (
        <Paperclip size={18} className="sm:w-5 sm:h-5" aria-hidden="true" />
      );
    if (selectedFile.type.startsWith("image/"))
      return <ImageIcon size={18} className="sm:w-5 sm:h-5 text-amber-600" />;
    if (selectedFile.type.startsWith("audio/"))
      return <Music size={18} className="sm:w-5 sm:h-5 text-blue-600" />;
    if (selectedFile.type.startsWith("video/"))
      return <Video size={18} className="sm:w-5 sm:h-5 text-red-600" />;
    return <FileText size={18} className="sm:w-5 sm:h-5 text-slate-600" />;
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-1 sm:px-3 md:px-4 pb-1 sm:pb-3">
      {/* ⚠️ Error Alert */}
      {error && (
        <div
          role="alert"
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm border border-red-100 z-50 animate-in fade-in zoom-in">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* 🖼️ Preview Bubble */}
      {selectedFile && (
        <div className="absolute -top-20 left-2 right-2 sm:right-auto flex items-center gap-2 bg-white border border-amber-100 p-1.5 rounded-xl shadow-xl animate-in slide-in-from-bottom-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              className="w-12 h-12 rounded-lg object-cover"
              alt="Preview"
            />
          ) : (
            <div className="bg-amber-50 w-12 h-12 rounded-lg flex items-center justify-center text-amber-600">
              {getFileIcon()}
            </div>
          )}
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[9px] font-bold truncate text-slate-800">
              {selectedFile.name}
            </p>
          </div>
          <button
            title="Remove attachment"
            onClick={clearFile}
            className="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-500 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ✍️ Input Surface - Clean & Spacious like your second screenshot */}
      <div
        className={`flex items-end gap-2 sm:gap-3 bg-[#fdfcf6] border border-slate-200 
        rounded-[1.75rem] sm:rounded-[2rem] px-3 py-1.5 sm:py-2 transition-all ${
          isSending
            ? "opacity-60"
            : "focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20"
        }`}>
        <button
          type="button"
          disabled={isSending}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          className="flex-shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          {getFileIcon()}
        </button>

        <input
          title="Attach file"
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept={MEDIA_LIMITS.ALLOWED_MIME_TYPES.join(",")}
        />

        <textarea
          id="ledger-input"
          ref={textAreaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isSending) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={disabled || isSending}
          placeholder="ሀሳብዎትን እዚህ ይጻፉ..."
          className="flex-1 min-w-0 max-h-[180px] min-h-[40px] sm:min-h-[44px] 
                     py-2.5 px-2 text-sm sm:text-base leading-tight
                     bg-transparent border-none focus:ring-0 outline-none resize-none 
                     text-slate-800 font-medium placeholder:text-slate-400 
                     selection:bg-amber-200"
          style={{ WebkitOverflowScrolling: "touch" }}
        />

        <button
          onClick={handleSend}
          disabled={disabled || isSending || (!value.trim() && !selectedFile)}
          aria-label="Send message"
          className="flex-shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-md hover:bg-amber-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          {isSending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default Composer;
