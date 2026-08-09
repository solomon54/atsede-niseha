// src/app/(dashboard)/settings/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import SettingsClient from "@/features/settings/components/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <SettingsClient
      role={(session.role as string) || "STUDENT"}
      uid={session.uid}
      email={session.email || ""}
    />
  );
}
