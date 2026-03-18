// src/app/(dashboard)/father/children/[id]/page.tsx

import { notFound } from "next/navigation";

import StudentProfileDetail from "@/features/father/components/StudentProfileDetail";
import { adminDb } from "@/services/firebase/admin";
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";

// Update the type to reflect that params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChildDetailPage({ params }: PageProps) {
  // 1. Await the params to get the ID
  const { id } = await params;

  if (!id) return notFound();

  // 2. Fetch from Firestore using the resolved ID
  const snapshot = await adminDb
    .collection("Students")
    .where("eotcUid", "==", id)
    .limit(1)
    .get();

  if (snapshot.empty) return notFound();

  const student = {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };

  return (
    <ImmersiveTransition className="pt-24 pb-12 px-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
          የተማሪው ዝርዝር መረጃ / Student Profile
        </h2>
      </div>
      <StudentProfileDetail student={student} />
    </ImmersiveTransition>
  );
}
