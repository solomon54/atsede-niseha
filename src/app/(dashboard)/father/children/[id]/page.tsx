import { notFound } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import StudentProfileDetail from "@/features/father/components/StudentProfileDetail";
import { ExtendedStudentRecord } from "@/features/father/components/StudentProfileDetail";
import { adminDb } from "@/services/firebase/admin";
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";

interface ChildPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChildDetailPage({ params }: ChildPageProps) {
  const { id } = await params;
  if (!id) return notFound();

  const [session, snapshot] = await Promise.all([
    getSession(),
    adminDb.collection("Students").where("eotcUid", "==", id).limit(1).get(),
  ]);

  if (snapshot.empty) return notFound();

  const doc = snapshot.docs[0];
  const student = { id: doc.id, ...doc.data() } as unknown as ExtendedStudentRecord;

  const isFather = session?.role === "FATHER" || session?.role === "GOVERNOR";

  return (
    <ImmersiveTransition className="pt-24 pb-12 px-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
          የተማሪው ዝርዝር መረጃ / Student Profile
        </h2>
      </div>
      <StudentProfileDetail student={student} isFather={isFather} />
    </ImmersiveTransition>
  );
}
