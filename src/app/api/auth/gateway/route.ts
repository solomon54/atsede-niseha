// src/app/api/auth/gateway/route.ts

import { NextResponse } from "next/server";

import { adminDb } from "@/services/firebase/admin";
import {
  FatherRecord,
  GatewayResponse,
  GovernorRecord,
  StudentRecord,
} from "@/shared/types";

type GatewayErrorCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "UNAUTHORIZED"
  | "SERVER_ERROR";

/**
 * Standardized success response helper
 */
function success(data: GatewayResponse) {
  return NextResponse.json(data, { status: 200 });
}

/**
 * Standardized failure response helper
 */
function fail(error: string, code: GatewayErrorCode, status: number) {
  return NextResponse.json({ success: false, error, code } as GatewayResponse, {
    status,
  });
}

/**
 * Safely parses request JSON to prevent runtime crashes
 */
async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await safeJson(req);
    if (!body || typeof body.eotcUid !== "string") {
      return fail("ትክክለኛ መለያ ቁጥር ያስገቡ", "NOT_FOUND", 400);
    }

    const id = body.eotcUid.trim().toUpperCase();
    if (id.length < 4) return fail("መለያ ቁጥር አይበቃም", "NOT_FOUND", 400);

    // Parallel lookup across all three primary collections
    const [govDoc, fatherQuery, studentQuery] = await Promise.all([
      adminDb.collection("Governors").doc(id).get(),
      adminDb.collection("Fathers").where("eotcUid", "==", id).limit(1).get(),
      adminDb.collection("Students").where("eotcUid", "==", id).limit(1).get(),
    ]);

    /**
     * 1. GOVERNOR FLOW
     * Governors are master-level users. They do not have a "CLAIM" step
     * as they are provisioned directly by the system admin.
     */
    if (govDoc.exists) {
      const data = govDoc.data() as GovernorRecord;
      if (!data || data.status !== "ACTIVE") {
        return fail("አካውንቱ ታግዷል", "INACTIVE", 403);
      }

      const displayName =
        data.christianName || data.fullName || data.secularName || "መሪ";

      return success({
        success: true,
        action: "LOGIN",
        role: "GOVERNOR",
        email: data.email,
        displayName,
        eotcUid: id,
        photoUrl: data.photoUrl,
        diocese: data.diocese,
      });
    }

    /**
     * 2. FATHER FLOW
     * Includes metadata for Diocese, Parish, and Clerical Title.
     */
    if (!fatherQuery.empty) {
      const doc = fatherQuery.docs[0];
      const data = doc.data() as FatherRecord;
      if (data.status === "INACTIVE") {
        return fail("ይህ መለያ ታግዷል", "INACTIVE", 403);
      }

      const displayName =
        data.christianName || data.fullName || data.secularName || "አባት";

      const profileData = {
        eotcUid: data.eotcUid || id,
        displayName,
        email: data.email,
        fullName: data.fullName,
        title: data.title,
        diocese: data.diocese,
        parish: data.parish,
        photoUrl: data.photoUrl,
      };

      if (data.accountClaimed) {
        return success({
          success: true,
          action: "LOGIN",
          role: "FATHER",
          ...profileData,
        });
      }

      return success({
        success: true,
        action: "CLAIM",
        role: "FATHER",
        data: profileData,
      });
    }

    /**
     * 3. STUDENT FLOW
     * Includes metadata for University and Academic context.
     */
    if (!studentQuery.empty) {
      const doc = studentQuery.docs[0];
      const data = doc.data() as StudentRecord;

      // Verification check for unapproved accounts
      if (!data.isApproved && !data.accountClaimed) {
        return fail("መለያዎ ገና አልጸደቀም።", "UNAUTHORIZED", 403);
      }

      const displayName =
        data.christianName || data.fullName || data.secularName || "ተማሪ";

      const profileData = {
        eotcUid: data.eotcUid || id,
        displayName,
        fullName: data.fullName,
        christianName: data.christianName,
        secularName: data.secularName,
        university: data.university,
        email: data.email,
        photoUrl: data.photoUrl,
        diocese: data.diocese,
      };

      if (data.accountClaimed) {
        return success({
          success: true,
          action: "LOGIN",
          role: "STUDENT",
          ...profileData,
        });
      }

      return success({
        success: true,
        action: "CLAIM",
        role: "STUDENT",
        data: profileData,
      });
    }

    // Default 404 if no record matches the EOTC-UID
    return fail("ያስገቡት መለያ ቁጥር አልተገኘም።", "NOT_FOUND", 404);
  } catch (error) {
    console.error("Gateway Critical Failure:", error);
    return fail("የውስጥ ሲስተም ስህተት።", "SERVER_ERROR", 500);
  }
}
