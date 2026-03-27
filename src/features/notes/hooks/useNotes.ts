// import { useEffect, useState, useRef, useCallback } from "react";
// import { NoteRepository } from "@/lib/db/repository";
// import { Note } from "@/types/note";
// import { encryptData, decryptData, deriveKey } from "@/lib/utils/encryption";

// interface UseNotesProps {
//   userId: string;
//   chapterId: string;
//   pageIndex: number;
//   password: string;
//   noteId?: string | null;
//   maxHistory?: number;
// }

// interface UseNotesReturn {
//   content: string;
//   title: string; // Added title
//   setTitle: (title: string) => void; // Added title setter
//   saveNote: (html: string, newTitle?: string) => void;
//   isSaving: boolean;
//   isLoading: boolean;
//   undo: () => void;
//   redo: () => void;
//   currentNoteId: string | null;
//   createNewNote: () => void; // Explicit create function
// }

// export function useNotes({
//   userId,
//   chapterId,
//   pageIndex,
//   password,
//   noteId,
//   maxHistory = 20,
// }: UseNotesProps): UseNotesReturn {
//   const [content, setContent] = useState<string>("");
//   const [title, setTitle] = useState<string>("");
//   const [isSaving, setIsSaving] = useState(false);
//   const [isLoading, setIsLoading] = useState(true);

//   // 💡 PERSISTENCE REFS: These "lock" the note's original location
//   const noteMetadata = useRef<{ chapterId: string; pageIndex: number } | null>(
//     null
//   );
//   const currentNoteId = useRef<string | null>(null);

//   const [historyStack, setHistoryStack] = useState<string[]>([]);
//   const [redoStack, setRedoStack] = useState<string[]>([]);
//   const saveTimeout = useRef<NodeJS.Timeout | null>(null);
//   const keyRef = useRef<CryptoKey | null>(null);

//   // Derive key on mount
//   useEffect(() => {
//     async function init() {
//       keyRef.current = await deriveKey(password, userId);
//       await loadCurrentNote();
//     }
//     init();
//   }, [password, userId]);

//   const loadCurrentNote = useCallback(async () => {
//     if (!keyRef.current) {
//       setIsLoading(false);
//       return;
//     }
//     setIsLoading(true);

//     try {
//       let targetNote: Note | undefined;

//       if (noteId) {
//         targetNote = await NoteRepository.getNoteById(noteId);
//       } else {
//         // COORDINATE SEARCH: Only happens if no specific ID is provided
//         const pageNotes = await NoteRepository.getNotesByChapter(chapterId);
//         targetNote = pageNotes.find(
//           (n) => n.userId === userId && n.pageIndex === pageIndex
//         );
//       }

//       if (targetNote) {
//         currentNoteId.current = targetNote.id;
//         // 💡 LOCK METADATA: Use what's in the DB, not what's in the props
//         noteMetadata.current = {
//           chapterId: targetNote.chapterId,
//           pageIndex: targetNote.pageIndex,
//         };

//         const decrypted = await decryptData(
//           targetNote.contentEncrypted,
//           keyRef.current
//         );
//         setContent(decrypted);
//         setTitle(targetNote.title || "");
//         setHistoryStack([decrypted]);
//       } else {
//         // NEW NOTE STATE
//         currentNoteId.current = null;
//         noteMetadata.current = null;
//         setContent("");
//         setTitle("");
//       }
//     } catch (err) {
//       console.error("Note load failed:", err);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [userId, chapterId, pageIndex, noteId]);

//   useEffect(() => {
//     loadCurrentNote();
//   }, [loadCurrentNote]);

//   const saveNote = useCallback(
//     (html: string, newTitle?: string) => {
//       // Allow passing a title directly or using the state
//       const activeTitle = newTitle !== undefined ? newTitle : title;
//       setContent(html);

//       if (saveTimeout.current) clearTimeout(saveTimeout.current);

//       saveTimeout.current = setTimeout(async () => {
//         if (!keyRef.current || !html.trim() || html === "<p></p>") return;

//         setIsSaving(true);
//         try {
//           const encrypted = await encryptData(html, keyRef.current);

//           // 💡 THE LOGIC FIX:
//           // If we have metadata (editing old note), use it.
//           // If not (new note), use the current page props.
//           const finalChapterId = noteMetadata.current?.chapterId ?? chapterId;
//           const finalPageIndex = noteMetadata.current?.pageIndex ?? pageIndex;

//           const note: Note = {
//             id: currentNoteId.current ?? crypto.randomUUID(),
//             userId,
//             chapterId: finalChapterId,
//             pageIndex: finalPageIndex,
//             title: activeTitle,
//             contentEncrypted: encrypted,
//             syncStatus: "pending",
//             updatedAt: new Date().toISOString(),
//           };

//           await NoteRepository.saveNote(note);

//           // If it was new, lock it in so subsequent saves don't change location
//           if (!currentNoteId.current) {
//             currentNoteId.current = note.id;
//             noteMetadata.current = {
//               chapterId: finalChapterId,
//               pageIndex: finalPageIndex,
//             };
//           }

//           setHistoryStack((prev) => [...prev.slice(-maxHistory + 1), html]);
//         } catch (err) {
//           console.error("Save failed:", err);
//         } finally {
//           setIsSaving(false);
//         }
//       }, 800);
//     },
//     [userId, chapterId, pageIndex, title, maxHistory]
//   );

//   const createNewNote = () => {
//     currentNoteId.current = null;
//     noteMetadata.current = null;
//     setContent("");
//     setTitle("");
//     setHistoryStack([]);
//     setRedoStack([]);
//   };

//   return {
//     content,
//     title,
//     setTitle,
//     saveNote,
//     isSaving,
//     isLoading,
//     undo: () => {},
//     redo: () => {},
//     currentNoteId: currentNoteId.current,
//     createNewNote,
//   };
// }
