import { NextResponse } from "next/server";

import { verifyEmailDeliverability } from "@/services/email/email.service";

export const runtime = "nodejs";

/**
 * Public endpoint used by the registration form to verify an email before the
 * father submits the record. It performs the same syntax + blocklist + MX
 * checks the API enforces, so the UI can block fake addresses early.
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_BUCKETS = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();

  // Keep the in-memory bucket map from growing without bound.
  if (RATE_LIMIT_BUCKETS.size > 5_000) {
    for (const [bucketKey, bucket] of RATE_LIMIT_BUCKETS) {
      if (bucket.resetAt <= now) RATE_LIMIT_BUCKETS.delete(bucketKey);
    }
  }

  const bucket = RATE_LIMIT_BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    RATE_LIMIT_BUCKETS.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(req: Request) {
  if (isRateLimited(clientKey(req))) {
    return NextResponse.json(
      {
        valid: false,
        code: "RATE_LIMITED",
        message: "ብዙ ጥያቄዎች። እባክዎ ከአንድ ደቂቃ በኋላ ይሞክሩ።",
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { valid: false, code: "INVALID_FORMAT", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const email =
    body && typeof body === "object" && "email" in body
      ? (body as { email?: unknown }).email
      : undefined;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json(
      { valid: false, code: "EMPTY", message: "ኢሜይል ያስገቡ" },
      { status: 400 }
    );
  }

  const result = await verifyEmailDeliverability(email);

  return NextResponse.json(result, { status: result.valid ? 200 : 422 });
}
