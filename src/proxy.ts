// src/proxy.ts

import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/services/firebase/admin";

/**
 * SOVEREIGN GATEKEEPER CONFIGURATION
 * Defines public entry points and the session identifier for the sanctuary.
 */
const PUBLIC_ROUTES_PREFIXES = ["/login", "/invite", "/public/", "/biranna/"];
const SESSION_COOKIE_NAME = "atsede_session";

/**
 * Next.js Middleware Configuration
 * Limits middleware execution to specific protected sanctuary paths.
 */
export const config = {
  matcher: [
    "/governor/:path*",
    "/api/governor/:path*",
    "/app/:path*",
    "/father/:path*",
    "/child/:path*",
    "/chat/:path*",
    "/timeline/:path*",
    "/api/private/:path*",
  ],
};

/**
 * Core Middleware Logic
 * Handles session verification, role extraction, and sanctuary access validation.
 * * @param req - Incoming NextRequest
 * @returns NextResponse (Redirect or Proceed with Headers)
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public Route Bypass
  if (PUBLIC_ROUTES_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Session Token Acquisition
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/", req.url));

  try {
    // 3. Token Verification & Claim Extraction
    const decodedToken = await adminAuth.verifySessionCookie(token, true);

    const userId = decodedToken.uid;
    const role = (decodedToken.role as string) || "USER";
    const eotcUid = decodedToken.eotcUid as string; // Extracted from new Custom Claim
    const linkedFatherId = decodedToken.father as string | undefined;

    /**
     * 4. Optimized Sanctuary Access Validation
     * Implementation Note: Governors are granted immediate access to bypass
     * document existence checks in specialized collections.
     */
    const relation = await validateSanctuaryAccess(userId, eotcUid, role);

    if (!relation.valid) {
      console.error(`🔒 Access Denied: Role [${role}] for UID [${userId}]`);
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    // 5. Header Injection for Downstream Consumption
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ats-user-id", userId);
    requestHeaders.set("x-ats-role", role);
    requestHeaders.set("x-ats-eotc-id", eotcUid || ""); // Sanitized for downstream usage

    /**
     * Impersonation Context Header
     * Injects the target UID if a Governor is managing a specific Father's profile.
     */
    const target = req.nextUrl.searchParams.get("target");
    if (target && role === "GOVERNOR") {
      requestHeaders.set("x-ats-impersonation-target", target);
    }

    if (linkedFatherId) requestHeaders.set("x-ats-father-id", linkedFatherId);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    // 6. Token Expiry or Corruption Handling
    const response = NextResponse.redirect(
      new URL("/login?expired=1", req.url)
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

/**
 * Validates account status with a focus on O(1) performance using eotcUid.
 * * @param userId - Firebase Auth UID
 * @param eotcUid - Spiritual EOTC Identifier (Custom Claim)
 * @param role - Authenticated User Role
 * @returns Object { valid: boolean }
 */
async function validateSanctuaryAccess(
  userId: string,
  eotcUid: string,
  role: string
) {
  /**
   * PROPRIETARY OVERDRIVE: Governor role is self-validating.
   * This prevents redirects for administrative accounts that do not
   * exist within the Fathers or Students Firestore collections.
   */
  if (role === "GOVERNOR") return { valid: true };

  try {
    // Determine collection based on role
    const isFather = role === "FATHER";
    const collectionName = isFather ? "Fathers" : "Students";

    /**
     * SMART LOOKUP: Attempt O(1) direct document access using eotcUid first.
     * This is the prioritized method using the ID provided in custom claims.
     */
    const doc = await adminDb.collection(collectionName).doc(eotcUid).get();
    let data = doc.data();

    // FALLBACK: If eotcUid lookup fails, perform indexed search by the Firebase uid field
    if (!doc.exists) {
      const query = await adminDb
        .collection(collectionName)
        .where("uid", "==", userId)
        .limit(1)
        .get();

      if (query.empty) return { valid: false };
      data = query.docs[0].data();
    }

    // Final Document Status Verification
    const isActive = data?.status === "ACTIVE";
    const isApproved = isFather ? data?.isApproved === true : true;

    return { valid: isActive && isApproved };
  } catch (error) {
    console.error(`[Middleware Validation Error]: ${error}`);
    return { valid: false };
  }
}
