// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/services/firebase/admin";

const SESSION_COOKIE_NAME = "atsede_session";

/**
 * Next.js Middleware Configuration
 * Protects ALL sanctuary routes. The root "/" is the only public entry.
 */
export const config = {
  matcher: [
    "/governor/:path*",
    "/father/:path*",
    "/student/:path*",
    "/messages/:path*",
    "/appointments/:path*",
    "/notes/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/api/governor/:path*",
    "/api/father/:path*",
    "/api/message/:path*",
    "/api/appointments/:path*",
    "/api/notifications/:path*",
    "/api/upload/:path*",
  ],
};

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/", req.url));

  try {
    const decodedToken = await adminAuth.verifySessionCookie(token, true);
    const userId = decodedToken.uid;
    const role = (decodedToken.role as string) || "USER";
    const eotcUid = decodedToken.eotcUid as string | undefined;
    const familyId = decodedToken.familyId as string | undefined;
    const linkedFatherId = decodedToken.father as string | undefined;

    // Validate that the account is still active in Firestore
    const relation = await validateSanctuaryAccess(userId, eotcUid, role);
    if (!relation.valid) {
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    // Role-based route guards
    if (pathname.startsWith("/governor") && role !== "GOVERNOR") {
      return NextResponse.redirect(new URL("/unauthorized?reason=role", req.url));
    }
    if (pathname.startsWith("/father") && role !== "FATHER" && role !== "GOVERNOR") {
      return NextResponse.redirect(new URL("/unauthorized?reason=role", req.url));
    }
    if (pathname.startsWith("/api/governor") && role !== "GOVERNOR") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Inject verified identity headers for downstream API routes
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ats-user-id", userId);
    requestHeaders.set("x-ats-role", role);
    requestHeaders.set("x-ats-eotc-id", eotcUid || "");
    requestHeaders.set("x-ats-family-id", familyId || "");

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
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

async function validateSanctuaryAccess(
  userId: string,
  eotcUid: string | undefined,
  role: string
) {
  if (role === "GOVERNOR") return { valid: true };

  try {
    const isFather = role === "FATHER";
    const collectionName = isFather ? "Fathers" : "Students";
    let data: FirebaseFirestore.DocumentData | null = null;

    if (eotcUid) {
      const doc = await adminDb.collection(collectionName).doc(eotcUid).get();
      data = doc.exists ? doc.data() ?? null : null;
    }

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
