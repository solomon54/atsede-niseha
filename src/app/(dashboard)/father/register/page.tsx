// src/app/(dashboard)/father/register/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import RegisterChildForm from "@/features/father/components/RegisterChildForm";
import { adminDb } from "@/services/firebase/admin";

/**
 * FATHER REGISTER PAGE
 * * Server-side entry point for spiritual child registration.
 * Supports dual-mode operation:
 * 1. Direct Access: For Fathers managing their own spiritual children.
 * 2. Management Mode: For Governors acting on behalf of a specific Father.
 * * @param searchParams - Promised URL parameters (Next.js 15 requirement)
 */
export default async function FatherRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  // 1. Session Acquisition
  const session = await getSession();

  /**
   * 2. Parameter Resolution (Next.js 15 Promise Unwrapping)
   * Essential for accessing dynamic URL segments like '?target=UID'
   */
  const params = await searchParams;

  /**
   * 3. Sovereign Authorization Check
   * Validates that the requester is either the designated Father or a System Governor.
   */
  const isAuthorized =
    session && (session.role === "FATHER" || session.role === "GOVERNOR");

  if (!isAuthorized) {
    redirect("/auth/login?reason=unauthorized");
  }

  const isGovernor = session.role === "GOVERNOR";

  /**
   * 4. Identity Resolution Logic
   * Determines the 'Effective UID' for database operations.
   * If a Governor provides a target, that target becomes the context.
   */
  const effectiveUid =
    isGovernor && params.target ? params.target : session.uid;

  /**
   * 5. Context Acquisition (Firestore)
   * Fetches the Father's spiritual profile to extract the eotcUid
   * required for the Covenant Mixer (Token Interleaving).
   */
  let fatherQuery = await adminDb
    .collection("Fathers")
    .where("uid", "==", effectiveUid)
    .limit(1)
    .get();

  /**
   * 6. Governor Sovereign Fallback
   * If a Governor accesses the portal without a specific target,
   * we automatically select the most recent Father record to ensure
   * the registration form has a valid spiritual context.
   */
  if (fatherQuery.empty && isGovernor) {
    fatherQuery = await adminDb
      .collection("Fathers")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
  }

  /**
   * 7. Safety Redirect
   * Ensures that we never render the form without a valid Father identity.
   */
  if (fatherQuery.empty) {
    console.error(
      `[Register Error] No Father profile found for Context: ${effectiveUid}`
    );
    redirect("/unauthorized?reason=profile_not_found");
  }

  const fatherData = fatherQuery.docs[0].data();

  /**
   * 8. UI Rendering
   * Injects the Father's ID and Spiritual ID into the Registration Form.
   */
  return (
    <main className="min-h-screen bg-[#FDFCFB] flex items-center justify-center relative overflow-hidden">
      {/* Immersive Sanctuary Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-amber-100/40 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-slate-200/50 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col items-center py-10">
        {/**
         * Sovereign Management Banner
         * Provides visual confirmation when a Governor is in Impersonation mode.
         */}
        {isGovernor && (
          <div className="mb-4 bg-amber-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg animate-in fade-in slide-in-from-top-2 duration-700">
            Governor Management Mode: {fatherData.fullName}
          </div>
        )}

        {/* Portal Branding */}
        <div className="mb-12 text-center space-y-4">
          <div className="mx-auto w-20 h-20 border-2 border-amber-200 rounded-full flex items-center justify-center bg-white shadow-xl">
            <span className="text-3xl">✞</span>
          </div>
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              ዐጸደ ንስሐ
            </h2>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.5em]">
              The Priestly Portal
            </p>
          </div>
        </div>

        {/**
         * THE COVENANT MIXER FORM
         * Passing fatherData.uid ensures the child is saved to the correct Father's path.
         * Passing fatherData.eotcUid ensures the Child Token is mixed correctly.
         */}
        <RegisterChildForm
          fatherId={fatherData.uid}
          fatherEotcId={fatherData.eotcUid}
        />

        <footer className="mt-12">
          <p className="text-[9px] text-center text-slate-400 font-bold leading-relaxed uppercase tracking-tighter">
            By registering this child, you agree to the <br />
            <span className="text-amber-700">
              Atsede Niseha Covenant of Secrecy
            </span>
          </p>
        </footer>
      </div>
    </main>
  );
}
