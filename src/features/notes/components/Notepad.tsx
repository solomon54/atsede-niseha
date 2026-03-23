// src/app/components/notes/Notepad.tsx
"use client";

import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useNotes } from "@/hooks/useNotes";
import { NoteRepository } from "@/lib/db/repository";
import {
  ETHIOPIAN_WEEKDAYS,
  formatAmharicDate,
} from "@/lib/utils/ethiopianCalendar";

import HistoryDrawer from "./HistoryDrawer";
import Toolbar from "./Toolbar";

interface NotepadProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (html: string, title?: string) => void;
  initialContent?: string;
  userId?: string;
  chapterId?: string;
  pageIndex?: number;
  password?: string;
  onGoToPage?: (pageIndex: number) => void;
}

interface HistoryNoteItem {
  id: string;
  title: string;
  date: string;
  pageIndex?: number;
  chapterId?: string;
}

export default function Notepad({
  isOpen,
  onClose,
  onSave = () => {},
  initialContent = "",
  userId,
  chapterId,
  pageIndex,
  password,
  onGoToPage,
}: NotepadProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyNotes, setHistoryNotes] = useState<HistoryNoteItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rawNotes, setRawNotes] = useState<any[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph", "listItem"] }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: "text-[#9b2d30] underline cursor-pointer" },
      }),
      Placeholder.configure({
        placeholder: "የሕንጸት ማስታወሻዎን እዚህ ይጀምሩ...",
      }),
    ],

    content: initialContent,
    immediatelyRender: false,

    editorProps: {
      attributes: {
        class:
          "prose prose-lg w-full max-w-full focus:outline-none break-words select-text cursor-text",
      },
    },
  });

  const { content, title, setTitle, saveNote, isLoading } = useNotes({
    userId: userId || "guest_user",
    chapterId: chapterId || "unknown",
    pageIndex: pageIndex ?? 0,
    password: password || "fallback_pass",
    noteId: activeNoteId,
  });

  useEffect(() => {
    if (!editor || content === undefined) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content, {
        parseOptions: { preserveWhitespace: "full" },
      });
    }
  }, [content, editor]);

  const debouncedSave = useMemo(() => {
    let timer: NodeJS.Timeout | null = null;
    const save = (html: string, title: string) => {
      if (!html.trim() || html === "<p></p>") return;
      saveNote(html, title);
      onSave(html, title);
    };
    const debounced = (html: string, title: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => save(html.trim(), title), 600);
    };
    debounced.cancel = () => {
      if (timer) clearTimeout(timer);
    };
    return debounced;
  }, [saveNote, onSave]);

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => debouncedSave(editor.getHTML(), title);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      debouncedSave.cancel();
    };
  }, [editor, debouncedSave, title]);

  useEffect(() => {
    if (!isHistoryOpen || !userId) return;
    let mounted = true;
    setHistoryLoading(true);

    (async () => {
      try {
        const notes = await NoteRepository.getAllUserNotes(userId);
        if (!mounted) return;
        setRawNotes(notes);

        const formatted = notes.map((n) => {
          const d = new Date(n.updatedAt);
          // Ethiopian date
          const ethDayName = ETHIOPIAN_WEEKDAYS[d.getDay()];
          const ethFullDate = formatAmharicDate(d, true);

          return {
            id: n.id,
            pageIndex: n.pageIndex,
            chapterId: n.chapterId,
            title:
              n.title ||
              `ምዕራፍ ${n.chapterId} • ገጽ ${Number(n.pageIndex ?? 0) + 1}`,
            date: `${ethDayName} ፣ ${ethFullDate} `,
          };
        });

        setHistoryNotes(formatted);
      } catch (err) {
        console.error("Failed to load note history:", err);
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isHistoryOpen, userId]);

  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    if (isHistoryOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isHistoryOpen]);

  const handleCreateNew = () => {
    setActiveNoteId(null);
    setTitle("");

    if (editor) {
      editor.commands.setContent("");
    }

    setIsHistoryOpen(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await NoteRepository.deleteNote(noteId);
      setHistoryNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) handleCreateNew();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  if (!editor) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-9998"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 240 }}
            className="fixed inset-x-0 bottom-0 z-9999 bg-[#fdf8f2] max-h-[94vh] rounded-t-3xl flex flex-col shadow-2xl border-t-4 border-[#9b2d30]/80">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#9b2d30]/20 bg-linear-to-b from-[#fdfaf7] to-[#fdf8f2]">
              <h2 className="text-xs font-semibold text-[#3d1c1d] flex items-center gap-3">
                <BookOpenText size={22} className="text-[#9b2d30]" />
                የሕንጸት ማስታወሻ
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-4 py-1.5 text-[0.75rem] font-medium bg-[#9b2d30]/10 hover:bg-[#9b2d30]/20 text-[#9b2d30] rounded-lg transition">
                  ማህደር
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition">
                  ዝጋው
                </button>
              </div>
            </div>

            {/* Title Section */}
            <div className="px-6 py-2 bg-[#fdf8f2] border-b border-[#9b2d30]/10 flex items-center gap-4">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setTitle(newTitle);
                  saveNote(editor?.getHTML() || "", newTitle);
                }}
                placeholder="ማስታወሻ ርዕስ (ለምሳሌ፡ የጠዋት ጸሎት...)"
                className="flex-1 bg-transparent border-none focus:ring-0 text-[#3d1c1d] font-bold placeholder:opacity-30 text-lg"
              />
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#9b2d30] text-white rounded-lg text-xs hover:bg-[#7f2428] transition shadow-md">
                + አዲስ ማስታወሻ
              </button>
            </div>

            {/* History Drawer Overlay  */}
            <AnimatePresence>
              {isHistoryOpen && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  style={{ touchAction: "none", userSelect: "auto" }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 w-5/6 sm:w-96 bg-[#fdfaf7] shadow-2xl z-10000 flex flex-col border-r border-[#9b2d30]/15 rounded-r-2xl overflow-hidden"
                  ref={drawerRef}>
                  <div className="p-5 border-b border-[#9b2d30]/10 bg-[#fdf8f2]">
                    <h3 className="text-lg font-semibold text-[#3d1c1d]">
                      ያሉ ማስታወሻዎች
                    </h3>
                  </div>
                  {historyLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-[#9b2d30] animate-spin" />
                    </div>
                  ) : historyNotes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[#9b2d30]/60 text-sm">
                      ገና ምንም ማስታወሻ የለም
                    </div>
                  ) : (
                    <HistoryDrawer
                      onClose={() => setIsHistoryOpen(false)}
                      notes={historyNotes}
                      onSelect={(selectedId) => {
                        const note = rawNotes.find((n) => n.id === selectedId);
                        if (note?.pageIndex !== undefined && onGoToPage)
                          onGoToPage(note.pageIndex);
                        setActiveNoteId(selectedId);
                        setIsHistoryOpen(false);
                      }}
                      onDelete={handleDeleteNote}
                      activeNoteId={activeNoteId}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Toolbar editor={editor} />

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-10 bg-[#fdf8f2] relative cursor-text">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('/assets/images/parchment-subtle.webp')] bg-repeat" />

              <div className="relative z-10 max-w-7xl mx-auto">
                <div className="prose prose-[--tw-prose-body:#3d1c1d] prose-headings:text-[#3d1c1d] prose-headings:font-serif prose-p:leading-[1.85] focus:outline-none min-h-dvh">
                  <EditorContent
                    editor={editor}
                    className="min-h-dvh outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer  */}
            <div className="p-5 border-t border-[#9b2d30]/15 bg-linear-to-t from-[#fdfaf7] to-[#fdf8f2] flex justify-end gap-4">
              <button
                onClick={() => saveNote(editor.getHTML(), title)}
                disabled={isLoading}
                className="px-8 py-3 bg-[#9b2d30] hover:bg-[#7f2428] text-white rounded-xl font-medium shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95">
                {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                መዝግብ
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
