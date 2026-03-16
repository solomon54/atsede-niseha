//src/app/(dashboard)/father/page.tsx

import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import FatherDashboardClient from "@/features/father/components/FatherDashboardClient";
import { adminDb } from "@/services/firebase/admin";

/**
 * FATHER DASHBOARD PAGE
 * Server-side controller for the Father's Sanctuary.
 * * Functional Modes:
 * 1. Standard: A Father views their own spiritual records.
 * 2. Impersonation: A Governor manages a specific Father's profile via '?target=' param.
 * * @param searchParams - The promised URL parameters for context switching.
 */
export default async function FatherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>; // Next.js 15 Requirement: Must be a Promise
}) {
  const session = await getSession();

  /**
   * 1. Dynamic Parameter Resolution
   * Required for context-aware routing in Next.js 15.
   */
  const params = await searchParams;

  /**
   * 2. Sovereign Authorization
   * Verified by Middleware, but enforced here to ensure session integrity.
   * Access granted to 'FATHER' and 'GOVERNOR' roles.
   */
  const isAuthorized =
    session && (session.role === "FATHER" || session.role === "GOVERNOR");

  if (!isAuthorized) {
    redirect("/auth/login?reason=unauthorized");
  }

  /**
   * 3. Identity Resolution (The "Sovereign Switch")
   * Determines if the current context should be the logged-in user
   * or a targeted Father provided by a Governor.
   */
  const isGovernor = session.role === "GOVERNOR";
  const effectiveUid =
    isGovernor && params.target ? params.target : session.uid;

  /**
   * 4. Context Extraction
   * Querying the 'Fathers' collection to retrieve spiritual metadata (eotcUid).
   */
  let fatherQuery = await adminDb
    .collection("Fathers")
    .where("uid", "==", effectiveUid)
    .limit(1)
    .get();

  /**
   * 5. Governor Sovereign Fallback
   * Production safety: If a Governor visits without a target and lacks
   * a personal Father record, the system auto-selects the most
   * recent Father to maintain UI continuity.
   */
  if (fatherQuery.empty && isGovernor) {
    fatherQuery = await adminDb
      .collection("Fathers")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
  }

  /**
   * 6. Hard Stop validation
   * Prevents unauthorized access to an empty context.
   */
  if (fatherQuery.empty) {
    console.error(
      `[Dashboard Error] No Father profile found for UID: ${effectiveUid}`
    );
    redirect("/unauthorized?reason=profile_not_found");
  }

  const fatherData = fatherQuery.docs[0].data();

  /**
   * 7. Sanctuary Render
   * Pass fatherData.uid (the context) instead of session.uid (the user)
   * to ensure the DashboardClient displays the correct spiritual children.
   */
  return (
    <FatherDashboardClient
      fatherId={fatherData.uid}
      fatherEotcId={fatherData.eotcUid}
      isManagementMode={isGovernor}
    />
  );
}
