// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/services/firebase/admin";

const SESSION_COOKIE_NAME = "atsede_session";
const BEARER_PREFIX = "Bearer ";

type SessionSource = "cookie" | "bearer" | "header";

/**
 * Resolve the session token from any supported transport.
 * - Web: httpOnly `atsede_session` cookie.
 * - Mobile: `Authorization: Bearer <session cookie>` (SecureStore has no cookie jar).
 */
function resolveSessionToken(
  req: NextRequest
): { token: string; source: SessionSource } | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) return { token: cookieToken, source: "cookie" };

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    const bearerToken = authHeader.slice(BEARER_PREFIX.length).trim();
    if (bearerToken) return { token: bearerToken, source: "bearer" };
  }

  const headerToken = req.headers.get("x-session-token")?.trim();
  if (headerToken) return { token: headerToken, source: "header" };

  return null;
}

/**
 * API clients (mobile) must receive JSON, never an HTML redirect.
 */
function unauthenticatedResponse(req: NextRequest, isApiRoute: boolean) {
  if (isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/", req.url));
}

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
    "/call/:path*",
    "/api/governor/:path*",
    "/api/father/:path*",
    "/api/auth/session",
    "/api/auth/refresh",
    "/api/livekit/:path*",
    "/api/message/:path*",
    "/api/appointments/:path*",
    "/api/notifications/:path*",
    "/api/upload/:path*",
  ],
};

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  const session = resolveSessionToken(req);
  if (!session) return unauthenticatedResponse(req, isApiRoute);

  try {
    const decodedToken = await adminAuth.verifySessionCookie(session.token, true);
    const userId = decodedToken.uid;
    const role = (decodedToken.role as string) || "USER";
    const eotcUid = decodedToken.eotcUid as string | undefined;
    const familyId = decodedToken.familyId as string | undefined;
    const linkedFatherId = decodedToken.father as string | undefined;

    // Validate that the account is still active in Firestore
    const relation = await validateSanctuaryAccess(userId, eotcUid, role);
    if (!relation.valid) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "FORBIDDEN", code: "NO_RELATION" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    // Role-based route guards
    const forbidden = () =>
      isApiRoute
        ? NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
        : NextResponse.redirect(new URL("/unauthorized?reason=role", req.url));

    if (
      (pathname.startsWith("/governor") ||
        pathname.startsWith("/api/governor")) &&
      role !== "GOVERNOR"
    ) {
      return forbidden();
    }
    if (
      (pathname.startsWith("/father") || pathname.startsWith("/api/father")) &&
      role !== "FATHER" &&
      role !== "GOVERNOR"
    ) {
      return forbidden();
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
    const response = unauthenticatedResponse(req, isApiRoute);
    if (session.source === "cookie") {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
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
