"use client";

import { useSession } from "@/core/auth/hooks";
import Notepad from "@/features/notes/components/Notepad";

export default function NotesPage() {
  const { session } = useSession();

  return (
    <div className="h-screen bg-[#fdfaf7]">
      <Notepad
        isOpen={true}
        onClose={() => {}} // In the app, this is a main page
        userId={session?.uid} // Only for local keying
        initialContent="<p>የሕንጸት ማስታወሻዎን እዚህ ይጀምሩ...</p>"
      />
    </div>
  );
}
