//src/features/notes/components/Editor.tsx
"use client";

import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import {
  type Editor as TiptapEditor,
  EditorContent,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface EditorProps {
  content?: string;
  onUpdate?: (html: string) => void;
  editorRef?: (editor: TiptapEditor) => void;
}

export default function Editor({ content, onUpdate, editorRef }: EditorProps) {
  const editor = useEditor({
    immediatelyRender: false,

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

      TextAlign.configure({
        types: ["heading", "paragraph", "listItem"],
      }),

      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-[#9b2d30] underline cursor-pointer font-bold",
        },
      }),

      Placeholder.configure({
        placeholder: "የሕንጸት ማስታወሻዎን እዚህ ይጀምሩ...",
      }),
    ],

    content,

    editorProps: {
      attributes: {
        class:
          "prose prose-lg w-full max-w-full focus:outline-none min-h-[400px] p-8 scroll-smooth break-words bg-white rounded-lg shadow-sm select-text cursor-text",
      },
    },

    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || !editorRef) return;
    editorRef(editor);
  }, [editor, editorRef]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
