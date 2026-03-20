// src/proxy.ts

import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/services/firebase/admin";

/**
 * SOVEREIGN GATEKEEPER CONFIGURATION
 * Public entry points and the session cookie for the sanctuary.
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
 * Adds robust downstream headers for application services.
 *
 * @param req - Incoming NextRequest
 * @returns NextResponse (Redirect or Proceed)
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public Route Bypass
  if (PUBLIC_ROUTES_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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
    const eotcUid = decodedToken.eotcUid as string | undefined; // defensive
    const linkedFatherId = decodedToken.father as string | undefined;

    // 4. Sanctuary Access Validation
    const relation = await validateSanctuaryAccess(userId, eotcUid, role);
    if (!relation.valid) {
      console.error(`🔒 Access Denied: Role [${role}] for UID [${userId}]`);
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    // 5. Header Injection for Downstream Services
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ats-user-id", userId);
    requestHeaders.set("x-ats-role", role);
    requestHeaders.set("x-ats-eotc-id", eotcUid || "");

    // Impersonation header: Only Governors can impersonate
    const target = req.nextUrl.searchParams.get("target");
    if (target && role === "GOVERNOR") {
      requestHeaders.set("x-ats-impersonation-target", target);
    }

    if (linkedFatherId) {
      requestHeaders.set("x-ats-father-id", linkedFatherId);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    console.error(`[Middleware Error]: ${err}`);
    const response = NextResponse.redirect(
      new URL("/login?expired=1", req.url)
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

/**
 * Validates account status with robust fallbacks.
 * - Governors bypass Firestore checks entirely.
 * - Fathers and Students are verified via eotcUid, with uid fallback.
 *
 * @param userId - Firebase Auth UID
 * @param eotcUid - Spiritual EOTC Identifier (Custom Claim)
 * @param role - Authenticated User Role
 * @returns { valid: boolean }
 */
async function validateSanctuaryAccess(
  userId: string,
  eotcUid: string | undefined,
  role: string
) {
  // Governor role is self-validating
  if (role === "GOVERNOR") return { valid: true };

  try {
    const isFather = role === "FATHER";
    const collectionName = isFather ? "Fathers" : "Students";

    let doc, data;

    // Primary lookup using eotcUid (O(1))
    if (eotcUid) {
      doc = await adminDb.collection(collectionName).doc(eotcUid).get();
      data = doc.exists ? doc.data() : null;
    }

    // Fallback: Indexed search by Firebase UID
    if (!data) {
      const query = await adminDb
        .collection(collectionName)
        .where("uid", "==", userId)
        .limit(1)
        .get();

      if (query.empty) return { valid: false };
      data = query.docs[0].data();
    }

    const isActive = data?.status === "ACTIVE";
    const isApproved = isFather ? data?.isApproved === true : true;

    return { valid: isActive && isApproved };
  } catch (error) {
    console.error(`[Middleware Validation Error]: ${error}`);
    return { valid: false };
  }
}
