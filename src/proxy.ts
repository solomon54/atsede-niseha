//src/proxy.ts
import { importX509, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/services/firebase/admin";
import { FirebaseIdTokenPayload } from "@/shared/types/shared.types.auth";

/**
 * SOVEREIGN AUTHENTICATION CONFIGURATION
 */
const PUBLIC_ROUTES_PREFIXES = ["/login", "/invite", "/public/", "/biranna/"];
const FIREBASE_CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

interface RelationResult {
  valid: boolean;
  since: Date;
}

/**
 * MIDDLEWARE CONFIG
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
 * SOVEREIGN GATEKEEPER
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass check for public routes
  if (PUBLIC_ROUTES_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Token extraction (ALIGNED with auth.service.ts cookie name)
  const token = req.cookies.get("session_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    // 3. Get Certificate for Firebase Verification
    const header = JSON.parse(atob(token.split(".")[0]));
    const certsRes = await fetch(FIREBASE_CERT_URL, {
      next: { revalidate: 3600 },
    });
    const certs = await certsRes.json();
    const x509Cert = certs[header.kid];

    if (!x509Cert) throw new Error("No matching Firebase certificate found");

    // 4. Cryptographic Verification
    const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

    const { payload } = await jwtVerify(
      token,
      await importX509(x509Cert, "RS256"),
      {
        issuer: `https://securetoken.google.com/${PROJECT_ID}`,
        audience: PROJECT_ID,
      }
    );

    const fbPayload = payload as FirebaseIdTokenPayload;

    // Extracting Identity and Role
    const childId = fbPayload.uid || (fbPayload.sub as string);
    const fatherId = fbPayload.father as string;
    const role = fbPayload.role || "USER";

    if (!childId) throw new Error("Incomplete session payload");

    // 5. Sovereignty Check: Relationship Validation (REAL DB CHECK)
    const relation = await isChildOfFather(childId, fatherId, role);

    if (!relation.valid) {
      console.error(`🔒 Access Denied: No link for ${role} ${childId}`);
      return NextResponse.redirect(
        new URL("/unauthorized?reason=no-relation", req.url)
      );
    }

    // 6. Header Injection for Server Components
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ats-user-id", childId);
    if (fatherId) requestHeaders.set("x-ats-father-id", fatherId);
    requestHeaders.set("x-ats-role", role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (err) {
    console.warn("⚠️ Security Alert: Invalid or Expired Session", err);

    const response = NextResponse.redirect(
      new URL("/login?expired=1", req.url)
    );
    response.cookies.delete("session_token");
    return response;
  }
}

/**
 * REAL RELATIONSHIP VALIDATOR
 * Connects directly to the 'Students' collection.
 */
async function isChildOfFather(
  childId: string,
  fatherId: string | undefined,
  role: string
): Promise<RelationResult> {
  // 1. System Governor has absolute bypass
  if (role === "GOVERNOR") {
    return { valid: true, since: new Date() };
  }

  // 2. Real Firestore check for Students/Fathers relationship
  try {
    const studentDoc = await adminDb.collection("Students").doc(childId).get();

    if (!studentDoc.exists) {
      return { valid: false, since: new Date() };
    }

    const studentData = studentDoc.data();

    // Check if the ecclesiastical fatherId matches the token
    const isValid = studentData?.fatherId === fatherId;

    return {
      valid: isValid,
      since: studentData?.joinedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error("❌ Sanctuary Ledger Access Error:", error);
    return { valid: false, since: new Date() };
  }
}
