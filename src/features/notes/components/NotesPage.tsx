"use client";
// src/features/notes/components/NotesPage.tsx

import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignCenter, AlignLeft, AlignRight,
  Bold, BookOpen, ChevronLeft,
  Italic, Link2, Link2Off, List,
  ListOrdered, Loader2, Lock,
  Palette, Plus, RotateCcw, Trash2,
  Underline as UnderlineIcon, X,
} from "lucide-react";
import {
  useCallback, useEffect, useRef, useState,
} from "react";

import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { cn } from "@/shared/utils/utils";

import { type DecryptedNote, useNotesLedger } from "../hooks/useNotesLedger";

/* ── Palette — project-aligned ink colors ── */
const COLORS = [
  { hex: "#9b2d30", label: "Cinnabar" },
  { hex: "#1e3a5f", label: "Deep Blue" },
  { hex: "#2f5d50", label: "Forest" },
  { hex: "#6b4c11", label: "Parchment" },
  { hex: "#4a0e8f", label: "Violet" },
  { hex: "#1a1a1a", label: "Ink" },
  { hex: "#374151", label: "Slate" },
  { hex: "#b45309", label: "Amber" },
  { hex: "#065f46", label: "Emerald" },
  { hex: "#7f1d1d", label: "Deep Red" },
];

interface Props { userId: string }

export default function NotesPage({ userId }: Props) {
  const { notes, loadNote, saveNote, deleteNote, saving } = useNotesLedger(userId);

  const [activeId, setActiveId]     = useState<string | null>(null);
  const [title, setTitle]           = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const currentIdRef = useRef<string | null>(null);

  /* ── Editor ── */
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-[#9b2d30] underline cursor-pointer hover:opacity-80",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder: "ሀሳብዎን እዚህ ይጀምሩ…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate prose-sm sm:prose-base max-w-none focus:outline-none min-h-[60vh] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      const newId = saveNote(currentIdRef.current, title, editor.getHTML());
      if (!currentIdRef.current) currentIdRef.current = newId;
    },
  });

  /* title auto-save */
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      saveNote(currentIdRef.current, title, editor.getHTML());
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  /* ── Open a note ── */
  const openNote = useCallback(
    async (id: string) => {
      setLoading(true);
      const note = await loadNote(id);
      if (!note) { setLoading(false); return; }
      setActiveId(id);
      currentIdRef.current = id;
      setTitle(note.title === "ያልተሰየመ ማስታወሻ" ? "" : note.title);
      editor?.commands.setContent(note.content || "");
      setLoading(false);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    [loadNote, editor]
  );

  /* ── New note ── */
  const newNote = useCallback(() => {
    setActiveId(null);
    currentIdRef.current = null;
    setTitle("");
    editor?.commands.clearContent();
    if (window.innerWidth < 768) setSidebarOpen(false);
    setTimeout(() => editor?.commands.focus(), 50);
  }, [editor]);

  /* ── Delete ── */
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNote(id);
      setConfirmDelete(null);
      if (activeId === id) newNote();
    },
    [deleteNote, activeId, newNote]
  );

  const wordCount = editor
    ? editor.getText().trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="relative flex h-screen bg-[#fdfaf7] overflow-hidden">
      <SanctuaryBackground />

      {/* ── SIDEBAR ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden absolute inset-0 z-20 bg-black/20 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />

            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="absolute md:relative z-30 w-64 h-full flex flex-col
                bg-[#fdfaf1] border-r border-amber-100/60 shadow-xl md:shadow-none shrink-0">

              <div className="flex items-center justify-between px-4 py-3.5
                border-b border-amber-100/60 shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#9b2d30]" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    ማኅደሬ
                  </span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5
                    bg-amber-50 rounded text-[7px] font-black text-amber-700
                    border border-amber-100">
                    <Lock className="w-2 h-2" /> LOCAL
                  </span>
                </div>
                <button type="button" onClick={() => setSidebarOpen(false)}
                  className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 py-2.5 shrink-0">
                <button type="button" onClick={newNote}
                  className="w-full flex items-center justify-center gap-1.5 py-2
                    rounded-xl border-2 border-dashed border-[#9b2d30]/20
                    text-[#9b2d30] text-[11px] font-bold hover:bg-[#9b2d30]/5 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> አዲስ ማስታወሻ
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1">
                {!notes || notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center opacity-40">
                    <BookOpen className="w-7 h-7 text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      ምንም ማስታወሻ የለም
                    </p>
                  </div>
                ) : (
                  notes.map((note) => {
                    const isActive = note.id === activeId;
                    return (
                      <div key={note.id} className="relative group">
                        {confirmDelete === note.id ? (
                          <div className="flex items-center justify-between p-2.5
                            bg-red-50 rounded-xl border border-red-100">
                            <p className="text-xs font-bold text-red-700">ይጥፋ?</p>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 text-[10px] bg-white rounded-lg
                                  text-slate-600 border border-slate-200">ተው</button>
                              <button type="button" onClick={() => handleDelete(note.id)}
                                className="px-2 py-1 text-[10px] bg-red-600 rounded-lg text-white">
                                አጥፋ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => openNote(note.id)}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl transition-all border",
                              isActive
                                ? "bg-[#9b2d30]/8 border-[#9b2d30]/20"
                                : "border-transparent hover:bg-amber-50/60"
                            )}>
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex-1 min-w-0">
                                {isActive && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#9b2d30] mb-1 animate-pulse" />
                                )}
                                <p className={cn(
                                  "text-[11px] font-bold truncate leading-snug",
                                  isActive ? "text-[#9b2d30]" : "text-slate-700"
                                )}>
                                  {note.title}
                                </p>
                                <p className="text-[9px] text-slate-400 mt-0.5">
                                  {new Date(note.updatedAt).toLocaleDateString("am-ET", {
                                    day: "numeric", month: "short",
                                  })}
                                  {note.wordCount > 0 && ` · ${note.wordCount}`}
                                </p>
                              </div>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(note.id); }}
                                className="shrink-0 p-1 text-transparent group-hover:text-slate-300
                                  hover:!text-red-500 transition-colors rounded">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── EDITOR AREA ── */}
      <main className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden z-10">

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white/95
          backdrop-blur-sm border-b border-slate-100 shrink-0 overflow-x-auto">
          <button type="button" onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
              hover:bg-slate-100 transition-colors mr-1 shrink-0">
            <List className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

          {editor && <EditorToolbar editor={editor} />}

          <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
            {saving && (
              <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Saving…</span>
              </span>
            )}
            <span className="flex items-center gap-1 px-1.5 py-1 bg-amber-50
              rounded-lg border border-amber-100">
              <Lock className="w-2.5 h-2.5 text-amber-600" />
              <span className="text-[7px] font-black text-amber-700 uppercase tracking-widest
                hidden sm:inline">Encrypted</span>
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="px-4 sm:px-10 pt-5 pb-2 shrink-0">
          <input type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ርዕስ…"
            className="w-full text-xl sm:text-2xl font-black text-slate-900
              bg-transparent border-none outline-none
              placeholder:text-slate-300 placeholder:font-light" />
          <div className="mt-1.5 h-px bg-gradient-to-r from-[#9b2d30]/15 to-transparent" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-10 py-2 border-t border-slate-100/60
          bg-white/50 flex items-center justify-between shrink-0">
          <p className="text-[9px] text-slate-400 font-bold">
            {wordCount} ቃላት
          </p>
          <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest hidden sm:block">
            ይዘቱ ከዚህ መሣሪያ አይወጣም
          </p>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOOLBAR
───────────────────────────────────────────── */
function EditorToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen]   = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkRef  = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  /* close popups on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setColorOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function applyLink() {
    const url = linkValue.trim();
    if (!url) { editor.chain().focus().unsetLink().run(); }
    else {
      const href = url.startsWith("http") ? url : `https://${url}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkValue("");
    setLinkOpen(false);
  }

  function openLink() {
    setColorOpen(false);
    setLinkValue(editor.getAttributes("link").href || "");
    setLinkOpen((v) => !v);
  }

  function openColor() {
    setLinkOpen(false);
    setColorOpen((v) => !v);
  }

  /* toolbar button helper */
  const Btn = ({
    onClick, active, title: t, children,
  }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button type="button" title={t} onClick={onClick}
      className={cn(
        "p-1.5 rounded-lg transition-colors shrink-0",
        active
          ? "bg-[#9b2d30] text-white"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      )}>
      {children}
    </button>
  );

  const sep = <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />;
  const sz  = "w-3.5 h-3.5";

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* Format */}
      <Btn onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")} title="Bold">
        <Bold className={sz} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")} title="Italic">
        <Italic className={sz} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className={sz} />
      </Btn>

      {sep}

      {/* Lists */}
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")} title="Bullet list">
        <List className={sz} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")} title="Ordered list">
        <ListOrdered className={sz} />
      </Btn>

      {sep}

      {/* Alignment — hidden on very small screens */}
      <div className="hidden sm:flex items-center gap-0.5">
        <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className={sz} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })} title="Center">
          <AlignCenter className={sz} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className={sz} />
        </Btn>
        {sep}
      </div>

      {/* ── LINK ── */}
      <div className="relative" ref={linkRef}>
        <Btn onClick={openLink} active={editor.isActive("link") || linkOpen} title="Link">
          <Link2 className={sz} />
        </Btn>
        <AnimatePresence>
          {linkOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl
                shadow-2xl border border-slate-100 p-3 w-64">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  አገናኝ / Link
                </p>
                <button type="button" onClick={() => setLinkOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                autoFocus
                type="url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyLink()}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl
                  outline-none focus:ring-2 focus:ring-[#9b2d30]/20 focus:border-[#9b2d30]/30
                  mb-2"
              />
              <div className="flex gap-1.5">
                {editor.isActive("link") && (
                  <button type="button"
                    onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl
                      border border-slate-200 text-slate-500 text-[10px] font-bold
                      hover:bg-slate-50 transition-colors">
                    <Link2Off className="w-3 h-3" /> Remove
                  </button>
                )}
                <button type="button" onClick={applyLink}
                  className="flex-1 py-1.5 bg-[#9b2d30] text-white rounded-xl
                    text-[10px] font-bold hover:bg-[#7f2428] transition-colors">
                  Apply
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── COLOR ── */}
      <div className="relative" ref={colorRef}>
        {/* Show current color as dot on button */}
        <button type="button" title="Text color" onClick={openColor}
          className={cn(
            "relative p-1.5 rounded-lg transition-colors shrink-0",
            colorOpen
              ? "bg-slate-100 text-slate-800"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          )}>
          <Palette className={sz} />
          {/* Color indicator underline */}
          <span
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full"
            style={{
              backgroundColor: editor.getAttributes("textStyle").color || "#1a1a1a",
            }}
          />
        </button>

        <AnimatePresence>
          {colorOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl
                shadow-2xl border border-slate-100 p-3 w-52">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  ቀለም / Color
                </p>
                <button type="button" onClick={() => setColorOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Color swatches */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {COLORS.map((c) => {
                  const isActive = editor.getAttributes("textStyle").color === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => {
                        editor.chain().focus().setColor(c.hex).run();
                        setColorOpen(false);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                        isActive ? "border-slate-800 scale-110" : "border-white shadow-sm"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>

              {/* Reset color */}
              <button type="button"
                onClick={() => { editor.chain().focus().unsetColor().run(); setColorOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5
                  rounded-xl border border-slate-200 text-slate-500 text-[10px]
                  font-bold hover:bg-slate-50 transition-colors">
                <RotateCcw className="w-3 h-3" />
                Reset Color
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
