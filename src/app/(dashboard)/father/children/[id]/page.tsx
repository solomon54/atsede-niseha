import { notFound } from "next/navigation";

import StudentProfileDetail from "@/features/father/components/StudentProfileDetail";
import { ExtendedStudentRecord } from "@/features/father/components/StudentProfileDetail";
import { adminDb } from "@/services/firebase/admin";
import { ImmersiveTransition } from "@/shared/components/ui/immersive-transition";

// 2. Explicitly define the props for this specific dynamic route
interface ChildPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChildDetailPage({ params }: ChildPageProps) {
  // 3. Await the params as required by Next.js 15+
  const { id } = await params;

  if (!id) return notFound();

  // 4. Fetch from 'Students' collection (PascalCase as per your schema )
  const snapshot = await adminDb
    .collection("Students")
    .where("eotcUid", "==", id)
    .limit(1)
    .get();

  if (snapshot.empty) return notFound();

  const doc = snapshot.docs[0];

  // 5. Cast to the Extended type to satisfy the component's requirements
  const student = {
    id: doc.id,
    ...doc.data(),
  } as unknown as ExtendedStudentRecord;

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
