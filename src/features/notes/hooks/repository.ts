// src/lib/db/repositories.ts
import { getDB } from "./client";
import { supabase } from "./supabase"; // your singleton client
import type { Note } from "@/types/note";
import type { Progress } from "@/types/progress";
import type { Content } from "@/types/content";

// ───────────────────────────────────────────────
//  SHARED HELPER: Safe authenticated user ID
// ───────────────────────────────────────────────
async function getAuthenticatedUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ───────────────────────────────────────────────
//  NOTE REPOSITORY
// ───────────────────────────────────────────────
export const NoteRepository = {
  async saveNote(note: Note, markPending = true): Promise<string> {
    const db = await getDB();
    const toSave = {
      ...note,
      syncStatus: markPending ? "pending" : "synced",
      updatedAt: new Date().toISOString(),
    };
    await db.put("notes", toSave);

    if (markPending) console.debug(`Note ${note.id} marked as pending`);
    return note.id;
  },

  async getNoteById(id: string): Promise<Note | undefined> {
    const db = await getDB();
    return db.get("notes", id);
  },

  async getNotesByChapter(chapterId: string): Promise<Note[]> {
    const db = await getDB();
    return db.getAllFromIndex("notes", "chapterId", chapterId);
  },

  async getPendingNotes(): Promise<Note[]> {
    const db = await getDB();
    return db.getAllFromIndex("notes", "syncStatus", "pending");
  },

  async getAllUserNotes(userId: string): Promise<Note[]> {
    const db = await getDB();
    const allNotes = await db.getAll("notes");
    return allNotes
      .filter((n) => n.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  },

  async getAllNotes(): Promise<Note[]> {
    const db = await getDB();
    const notes = await db.getAll("notes");
    return notes.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async deleteNote(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("notes", id);
  },

  async pushPending(): Promise<void> {
    const userId = await getAuthenticatedUserId();
    if (!userId) return;

    const db = await getDB();
    const pending = await db.getAllFromIndex("notes", "syncStatus", "pending");
    const userPending = pending.filter((n) => n.userId === userId);
    if (!userPending.length) return;

    console.debug(
      `Syncing ${userPending.length} pending notes for user ${userId}`
    );
    for (const note of userPending) {
      const { syncStatus, ...serverData } = note;
      const { error } = await supabase
        .from("user_notes")
        .upsert(serverData, { onConflict: "id" });
      if (!error) await db.put("notes", { ...note, syncStatus: "synced" });
      else console.error("Note sync failed:", error.message, note.id);
    }
  },

  async pullFromServer(): Promise<void> {
    const userId = await getAuthenticatedUserId();
    if (!userId) return;

    const db = await getDB();
    const { data, error } = await supabase
      .from("user_notes")
      .select("*")
      .eq("userId", userId);
    if (error) return console.error("Pull notes failed:", error.message);

    for (const serverNote of data ?? []) {
      const localNote = await db.get("notes", serverNote.id);
      if (
        !localNote ||
        new Date(serverNote.updatedAt) > new Date(localNote.updatedAt)
      ) {
        await db.put("notes", { ...serverNote, syncStatus: "synced" });
      }
    }
  },
};

// ───────────────────────────────────────────────
//  PROGRESS REPOSITORY
// ───────────────────────────────────────────────
export const ProgressRepository = {
  async updateProgress(progress: Progress, markPending = true): Promise<void> {
    const db = await getDB();
    const toSave = {
      ...progress,
      syncStatus: markPending ? "pending" : "synced",
      updatedAt: new Date().toISOString(),
    };

    await db.put("progress", toSave);

    // No auto-push — controlled by global sync
    if (markPending) {
      console.debug(`Progress ${progress.chapterId} marked pending`);
    }
  },

  async getProgress(
    userId: string,
    chapterId: string
  ): Promise<Progress | undefined> {
    const db = await getDB();
    return db.get("progress", [userId, chapterId]);
  },

  // RESTORED: Used in Book.tsx / resume logic
  async getAllProgress(userId: string): Promise<Progress[]> {
    const db = await getDB();

    // Safe fallback — works even if index is missing
    const all = await db.getAll("progress");

    return all.filter((p) => p.userId === userId);
  },

  async saveLastPageRead(
    userId: string,
    chapterId: string,
    page: number
  ): Promise<void> {
    const current = (await this.getProgress(userId, chapterId)) ?? {
      userId,
      chapterId,
      lastPageRead: 0,
      completedActions: [],
      isCompleted: false,
      updatedAt: new Date().toISOString(),
    };

    const updated: Progress = {
      ...current,
      lastPageRead: page,
      updatedAt: new Date().toISOString(),
    };

    await this.updateProgress(updated, true);
  },

  async toggleAction(
    userId: string,
    chapterId: string,
    actionId: string,
    totalActionsInChapter: number
  ): Promise<Progress> {
    const current = (await this.getProgress(userId, chapterId)) ?? {
      userId,
      chapterId,
      lastPageRead: 0,
      completedActions: [],
      isCompleted: false,
      updatedAt: new Date().toISOString(),
    };

    const actions = current.completedActions ?? [];
    const newActions = actions.includes(actionId)
      ? actions.filter((id) => id !== actionId)
      : [...actions, actionId];

    const updated: Progress = {
      ...current,
      completedActions: newActions,
      isCompleted: newActions.length === totalActionsInChapter,
      updatedAt: new Date().toISOString(),
    };

    await this.updateProgress(updated, true);
    return updated;
  },

  async pushPending(): Promise<void> {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      console.debug("pushPending progress: no authenticated user → skipping");
      return;
    }

    const db = await getDB();
    const all = await db.getAll("progress");
    const pending = all.filter(
      (p) => p.userId === userId && p.syncStatus === "pending"
    );

    if (pending.length === 0) return;

    console.debug(
      `Syncing ${pending.length} pending progress items for user ${userId}`
    );

    for (const progress of pending) {
      const { syncStatus, ...serverData } = progress;

      const { error } = await supabase
        .from("user_progress")
        .upsert(serverData, { onConflict: "userId,chapterId" });

      if (!error) {
        await db.put("progress", { ...progress, syncStatus: "synced" });
      } else {
        console.error("Progress sync failed:", error.message);
      }
    }
  },

  async pullFromServer(): Promise<void> {
    const userId = await getAuthenticatedUserId();
    if (!userId) return;

    const db = await getDB();

    const { data, error } = await supabase
      .from("user_progress")
      .select("*")
      .eq("userId", userId);

    if (error) {
      console.error("Pull progress failed:", error.message);
      return;
    }

    for (const serverItem of data ?? []) {
      const localItem = await db.get("progress", [
        serverItem.userId,
        serverItem.chapterId,
      ]);
      if (
        !localItem ||
        new Date(serverItem.updatedAt) > new Date(localItem.updatedAt)
      ) {
        await db.put("progress", { ...serverItem, syncStatus: "synced" });
      }
    }
  },
};

// ───────────────────────────────────────────────
//  GLOBAL SYNC HANDLER (online + login/reconnect)
// ───────────────────────────────────────────────
if (typeof window !== "undefined") {
  const runFullSync = async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      console.debug("Global sync skipped: no authenticated user");
      return;
    }

    console.debug(`Starting full sync for user ${userId}`);

    await Promise.all([
      ProgressRepository.pushPending(),
      NoteRepository.pushPending(),
    ]);

    console.debug("Full sync completed");
  };

  // 1. Sync when internet is restored
  window.addEventListener("online", () => {
    runFullSync().catch((err) => console.error("Online sync failed:", err));
  });

  // 2. Sync when user signs in or token is refreshed
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      session?.user?.id &&
      (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
    ) {
      runFullSync().catch((err) =>
        console.error("Auth-triggered sync failed:", err)
      );
    }
  });

  // 3. Initial sync on app load (if already logged in)
  runFullSync().catch((err) => console.error("Initial sync failed:", err));
}

// ───────────────────────────────────────────────
//  CONTENT REPOSITORY (unchanged)
// ───────────────────────────────────────────────
export const ContentRepository = {
  async saveChapter(content: Content): Promise<void> {
    const db = await getDB();
    await db.put("content", content);
  },

  async getChapter(id: string): Promise<Content | undefined> {
    const db = await getDB();
    return db.get("content", id);
  },
};
