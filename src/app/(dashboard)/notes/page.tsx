import Notepad from "@/features/notes/components/Notepad";
import { UserSession } from "@/shared/types/shared.types.auth";

function NotesPage() {
  // const { session } = await UserSession();

  return (
    <div className="h-screen bg-[#fdfaf7]">
      <>
        <div className="min-h-screen flex items-center justify-center">
          <h1 className="text-3xl font-bold text-slate-500 shadow-2xl ">
            Comming Soon!
          </h1>
        </div>
      </>

      {/* <Notepad
        isOpen={true}
        onClose={() => {}} // In the app, this is a main page
        userId={session?.uid} // Only for local keying
        initialContent="<p>የሕንጸት ማስታወሻዎን እዚህ ይጀምሩ...</p>"
      /> */}
    </div>
  );
}

export default NotesPage;
