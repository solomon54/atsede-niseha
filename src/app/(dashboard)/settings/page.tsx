//src/app/(dashboard)/settings/page.tsx
import { exp } from "firebase/firestore/pipelines";
import { redirect } from "next/navigation";
import { de } from "zod/locales";

import { getSession } from "@/core/auth/session.service";

async function SettingsPage() {
  const session = await getSession();

  if (!session) redirect("/");

  return (
    <>
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-500 shadow-2xl ">
          Comming Soon!
        </h1>
      </div>
    </>
  );
}

export default SettingsPage;
