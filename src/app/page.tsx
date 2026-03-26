// src/app/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import UnifiedGatewayClient from "@/features/auth/components/UnifiedGatewayClient";

export default async function Page() {
  // 1. SILENT CHECK: Done on the server before ANY bytes reach the browser
  const session = await getSession();

  // 2. PASS-THROUGH: If valid session exists, jump straight to the sanctuary
  if (session) {
    const role = (session.role as string)?.toLowerCase();
    if (role === "governor") redirect("/governor");
    if (role === "father") redirect("/father");
    if (role === "student") redirect("/student");
  }

  // 3. SHOW GATEWAY: If no session, show your beautiful "Unified Gateway"
  return <UnifiedGatewayClient />;
}
