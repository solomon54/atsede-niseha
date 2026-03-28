//src/app/(dsashboard)/student/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";

export default async function StudentPage() {
  const session = await getSession();

  if (!session || session.role !== "STUDENT") {
    redirect("/");
  }

  // No more placeholders. Land them in the conversation.
  redirect("/messages");
}
