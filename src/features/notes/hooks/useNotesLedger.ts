// src/features/notes/hooks/useNotesLedger.ts
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useRef, useState } from "react";

import { type LocalNote, notesDb } from "../db/notes-db";
import { decryptNote, encryptNote } from "../services/crypto";

export interface DecryptedNote extends Omit<LocalNote, "encryptedContent" | "iv"> {
  content: string;
}

export function useNotesLedger(userId: string) {
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── All notes for this user, newest first ── */
  const rawNotes = useLiveQuery(
    () =>
      notesDb.notes
        .where("userId")
        .equals(userId)
        .reverse()
        .sortBy("updatedAt"),
    [userId]
  );

  const notes: DecryptedNote[] = rawNotes
    ? rawNotes.map((n) => ({ ...n, content: "" })) // titles only for list
    : [];

  /* ── Load a single note with decryption ── */
  const loadNote = useCallback(
    async (id: string): Promise<DecryptedNote | null> => {
      const note = await notesDb.notes.get(id);
      if (!note) return null;
      const content = await decryptNote(userId, note.encryptedContent, note.iv);
      return { ...note, content };
    },
    [userId]
  );

  /* ── Save (debounced 800ms) ── */
  const saveNote = useCallback(
    (id: string | null, title: string, htmlContent: string): string => {
      const noteId = id ?? crypto.randomUUID();
      const now = Date.now();

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const { ciphertext, iv } = await encryptNote(userId, htmlContent);
          const wordCount = htmlContent.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;

          const existing = await notesDb.notes.get(noteId);
          await notesDb.notes.put({
            id: noteId,
            userId,
            title: title.trim() || "ያልተሰየመ ማስታወሻ",
            encryptedContent: ciphertext,
            iv,
            wordCount,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
        } finally {
          setSaving(false);
        }
      }, 800);

      return noteId;
    },
    [userId]
  );

  /* ── Delete ── */
  const deleteNote = useCallback(async (id: string) => {
    await notesDb.notes.delete(id);
  }, []);

  return { notes, loadNote, saveNote, deleteNote, saving };
}
