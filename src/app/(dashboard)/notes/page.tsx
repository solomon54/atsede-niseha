// src/app/(dashboard)/notes/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import NotesPage from "@/features/notes/components/NotesPage";

export default async function Notes() {
  const session = await getSession();
  if (!session) redirect("/");

  return <NotesPage userId={session.uid} />;
}
