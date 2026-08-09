// src/app/(dashboard)/appointments/page.tsx
import { redirect } from "next/navigation";

import { requireSession } from "@/core/auth/requireSession";
import AppointmentsClient from "@/features/appointments/components/AppointmentsClient";

export default async function AppointmentsPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/?reason=unauthorized");
  }

  if (session.role !== "FATHER" && session.role !== "STUDENT") {
    redirect("/?reason=unauthorized");
  }

  return (
    <AppointmentsClient
      role={session.role as "FATHER" | "STUDENT"}
      uid={session.uid}
      familyId={session.familyId}
    />
  );
}
