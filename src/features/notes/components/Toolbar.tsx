"use client";

import { FC, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List as ListBullet,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Link as LinkIcon,
  Palette,
  RotateCcw,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  X,
} from "lucide-react";

interface ToolbarProps {
  editor: any;
}

/* Project-aligned colors */
const COLORS = [
  "#9b2d30", // cinnabar
  "#3d1c1d", // deep ink
  "#6b8e23", // olive green
  "#c2a83e", // antique gold
  "#457b9d", // muted blue
  "#2f5d50", // forest
  "#000000",
];

const Toolbar: FC<ToolbarProps> = ({ editor }) => {
  const [linkInput, setLinkInput] = useState("");
  const [popupType, setPopupType] = useState<"link" | "color" | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  if (!editor) return null;

  const openPopup = (type: "link" | "color", ref: any) => {
    const rect = ref.current.getBoundingClientRect();
    let left = rect.left;
    // Ensure popup fits on screen
    const popupWidth = 240;
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }

    setPosition({
      top: rect.bottom + 10,
      left,
    });

    if (type === "link") {
      const href = editor.getAttributes("link")?.href || "";
      setLinkInput(href);
    }

    setPopupType(type);
  };

  const closePopup = () => setPopupType(null);

  /* Close on outside click */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        closePopup();
      }
    };

    if (popupType) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupType]);

  const applyLink = (href: string) => {
    if (!href) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href }).run();
    closePopup();
  };

  const applyColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    closePopup();
  };

  const unsetColor = () => {
    editor.chain().focus().unsetColor().run();
    closePopup();
  };

  const Btn = ({ onClick, active, children, label, btnRef }: any) => (
    <button
      ref={btnRef}
      type="button"
      title={label}
      onClick={onClick}
      className={`p-1 md:p-2 rounded-md transition-all text-[12px] md:text-sm ${
        active
          ? "bg-[#9b2d30] text-white"
          : "hover:bg-[#9b2d30]/10 text-[#3d1c1d]"
      }`}>
      {children}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-1 p-2 bg-[#f5e9d6]/90 border-b border-[#9b2d30]/10">
        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()} label="Undo">
          <Undo size={16} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} label="Redo">
          <Redo size={16} />
        </Btn>

        {/* Bold / Italic / Underline */}
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Bold">
          <Bold size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Italic">
          <Italic size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          label="Underline">
          <UnderlineIcon size={16} />
        </Btn>

        {/* Headings & Paragraph */}
        {[1, 2, 3, 4].map((lvl) => {
          const icons = [Heading1, Heading2, Heading3, Heading4];
          const Icon = icons[lvl - 1];
          return (
            <Btn
              key={lvl}
              onClick={() => {
                const isActive = editor.isActive("heading", { level: lvl });
                editor
                  .chain()
                  .focus()
                  [isActive ? "setParagraph" : "toggleHeading"]({ level: lvl })
                  .run();
              }}
              active={editor.isActive("heading", { level: lvl })}
              label={`Heading ${lvl}`}>
              <Icon size={16} />
            </Btn>
          );
        })}
        <Btn
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={!editor.isActive("heading")}
          label="Paragraph">
          <Pilcrow size={16} />
        </Btn>

        {/* Link / Color */}
        <Btn
          btnRef={linkBtnRef}
          onClick={() => openPopup("link", linkBtnRef)}
          active={editor.isActive("link")}
          label="Link">
          <LinkIcon size={16} />
        </Btn>
        <Btn
          btnRef={colorBtnRef}
          onClick={() => openPopup("color", colorBtnRef)}
          label="Color">
          <Palette size={16} />
        </Btn>

        {/* Lists */}
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Bullets">
          <ListBullet size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Numbers">
          <ListOrdered size={16} />
        </Btn>

        {/* Text Align */}
        <Btn
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          label="Align Left">
          <AlignLeft size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          label="Align Center">
          <AlignCenter size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          label="Align Right">
          <AlignRight size={16} />
        </Btn>
      </div>

      {/* Floating Popups */}
      {popupType &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: 100000,
            }}
            className="bg-[#f4ece1] border border-[#9b2d30]/30 rounded-lg shadow-2xl p-3 min-w-[200px] md:min-w-[240px]">
            <div className="flex justify-end mb-2">
              <button title="close" onClick={closePopup}>
                <X size={16} />
              </button>
            </div>

            {popupType === "link" && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="Enter URL"
                  className="border px-2 py-1 rounded text-sm bg-white"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={closePopup}
                    className="px-2 py-1 text-sm rounded border border-[#9b2d30]/30">
                    Cancel
                  </button>
                  <button
                    onClick={() => applyLink(linkInput)}
                    className="bg-[#9b2d30] text-white px-3 py-1 text-sm rounded">
                    Apply
                  </button>
                </div>
              </div>
            )}

            {popupType === "color" && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      title="applay"
                      key={c}
                      onClick={() => applyColor(c)}
                      className="w-7 h-7 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={unsetColor}
                  className="flex items-center gap-2 text-sm text-[#9b2d30]">
                  <RotateCcw size={14} />
                  Reset Color
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default Toolbar;
