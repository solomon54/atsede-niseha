//src/proxy.ts

import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/services/firebase/admin";

/**
 * SOVEREIGN GATEKEEPER CONFIGURATION
 */
const PUBLIC_ROUTES_PREFIXES = ["/login", "/invite", "/public/", "/biranna/"];
const SESSION_COOKIE_NAME = "atsede_session";

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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/", req.url));

  try {
    // Verified Pro Logic: Uses SDK for Session Cookies
    const decodedToken = await adminAuth.verifySessionCookie(token, true);

    const userId = decodedToken.uid;
    const role = (decodedToken.role as string) || "USER";
    const linkedFatherId = decodedToken.father as string | undefined;

    const relation = await validateSanctuaryAccess(
      userId,
      linkedFatherId,
      role
    );

    if (!relation.valid) {
      console.error(`🔒 Access Denied: Role [${role}] for UID [${userId}]`);
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ats-user-id", userId);
    requestHeaders.set("x-ats-role", role);
    if (linkedFatherId) requestHeaders.set("x-ats-father-id", linkedFatherId);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    const response = NextResponse.redirect(
      new URL("/login?expired=1", req.url)
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

async function validateSanctuaryAccess(
  userId: string,
  fatherIdInToken: string | undefined,
  role: string
) {
  if (role === "GOVERNOR") return { valid: true };

  try {
    if (role === "FATHER") {
      // PRO FIX: Try direct ID first, then fallback to field query
      const fatherDoc = await adminDb.collection("Fathers").doc(userId).get();
      let data = fatherDoc.data();

      if (!fatherDoc.exists) {
        const query = await adminDb
          .collection("Fathers")
          .where("uid", "==", userId)
          .limit(1)
          .get();
        if (query.empty) return { valid: false };
        data = query.docs[0].data();
      }

      return {
        valid: data?.status === "ACTIVE" && data?.isApproved === true,
      };
    }

    if (role === "STUDENT") {
      const studentDoc = await adminDb.collection("Students").doc(userId).get();
      if (!studentDoc.exists) return { valid: false };
      const data = studentDoc.data();
      return { valid: data?.status === "ACTIVE" };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}
