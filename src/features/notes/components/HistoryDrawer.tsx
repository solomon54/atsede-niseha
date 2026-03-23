//src/app/components/notes/HistoryDrawer.tsx
"use client";

import { FC, useState } from "react";
import { ChevronLeft, List, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HistoryDrawerProps {
  onClose: () => void;
  notes: Array<{
    id: string;
    title?: string;
    date?: string;
    chapterTitle?: string;
    pageIndex?: number;
  }>;
  onSelect: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  activeNoteId: string | null;
  isOffline?: boolean;
}

const HistoryDrawer: FC<HistoryDrawerProps> = ({
  onClose,
  notes,
  onSelect,
  onDelete,
  activeNoteId,
  isOffline = false,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Safe newest-first sort (handles Amharic locale strings safely)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="flex flex-col h-full bg-[#fdfaf7] overflow-hidden relative">
      {/* Compact Header */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-[#9b2d30]/10 bg-[#fdfaf7]/95 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <List size={20} className="text-[#9b2d30]" />
          <h3 className="font-bold text-lg text-[#3d1c1d]">ማህደር</h3>
          {isOffline && (
            <span className="px-2 py-px text-[9px] font-mono bg-amber-100 text-amber-700 rounded">
              OFFLINE
            </span>
          )}
        </div>

        <button
          title="close"
          onClick={onClose}
          className="p-2 active:bg-[#9b2d30]/10 rounded-full transition-all">
          <ChevronLeft size={24} className="text-[#3d1c1d]" />
        </button>
      </div>

      {/* Compact Scrollable List – Mobile Optimized */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 overscroll-contain">
        {/* New Note Button – Compact */}
        <button
          onClick={() => onSelect("NEW_NOTE")}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-bold text-base active:scale-[0.985] transition-all ${
            !activeNoteId
              ? "border-[#9b2d30] bg-[#9b2d30] text-white shadow-inner"
              : "border-dashed border-[#9b2d30]/40 text-[#9b2d30] hover:bg-[#9b2d30]/5"
          }`}>
          <Plus size={20} />
          አዲስ ማስታወሻ
        </button>

        {sortedNotes.length > 0 ? (
          sortedNotes.map((note) => {
            const isActive = activeNoteId === note.id;
            const isDeleting = deletingId === note.id;

            return (
              <div
                key={note.id}
                className={`relative overflow-hidden rounded-2xl border transition-all duration-200 shadow-sm ${
                  isActive
                    ? "border-[#9b2d30] bg-white shadow-md"
                    : "border-[#9b2d30]/10 bg-white/80 hover:border-[#9b2d30]/30"
                }`}>
                <AnimatePresence mode="wait">
                  {isDeleting ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="flex items-center justify-between p-4 bg-red-50">
                      <span className="text-sm font-medium text-red-800">
                        ይጥፋ?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="px-4 py-2 text-sm bg-white rounded-xl text-gray-600 active:bg-gray-100">
                          ተው
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(note.id);
                            setDeletingId(null);
                          }}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl active:bg-red-700">
                          አጥፋ
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="normal"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 cursor-pointer active:bg-[#fdfaf7]"
                      onClick={() => onSelect(note.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 mb-1">
                            {isActive && (
                              <div className="w-2 h-2 rounded-full bg-[#9b2d30] animate-pulse shrink-0" />
                            )}
                            <p
                              className={`font-bold text-[15px] leading-tight truncate ${
                                isActive ? "text-[#9b2d30]" : "text-[#3d1c1d]"
                              }`}>
                              {note.title || "Untitled Reflection"}
                            </p>
                          </div>

                          {(note.chapterTitle ||
                            note.pageIndex !== undefined) && (
                            <p className="text-[#9b2d30]/70 text-xs mb-1.5">
                              {note.chapterTitle}{" "}
                              {note.pageIndex !== undefined &&
                                `• ገጽ ${note.pageIndex}`}
                            </p>
                          )}

                          <p className="text-[10px] text-gray-500 tabular-nums">
                            {note.date}
                          </p>
                        </div>

                        <button
                          title="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(note.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 active:text-red-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
            <div className="w-12 h-12 mb-3 border-2 border-dashed border-[#9b2d30]/30 rounded-full flex items-center justify-center">
              <List size={24} className="text-[#9b2d30]/40" />
            </div>
            <p className="text-sm text-[#3d1c1d]">ምንም ማስታወሻ የለም</p>
          </div>
        )}
      </div>

      {/* Bottom gradient to prevent last item clipping on mobile */}
      <div className="absolute bottom-0 inset-x-0 h-16 pointer-events-none bg-linear-to-t from-[#fdfaf7] to-transparent" />
    </div>
  );
};

export default HistoryDrawer;
