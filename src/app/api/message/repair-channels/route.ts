// src/app/api/message/repair-channels/route.ts
/**
 * CHANNEL REPAIR ENDPOINT
 * ─────────────────────────────────────────────
 * Called on first load for users who claimed their account before
 * the DIRECT channel provisioning was fixed.
 *
 * Safe to call multiple times — fully idempotent.
 * It only creates what is missing. Never duplicates.
 */

import { NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import { joinStudentToFamilyChannels } from "@/features/messaging/services/channelProvision.service";
import { adminDb } from "@/services/firebase/admin";

export async function POST(): Promise<Response> {
  try {
    const session = await requireSession();

    // Only students need repair — fathers provision on their own claim
    if (session.role !== "STUDENT") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Find the student's eotcUid so we can call joinStudentToFamilyChannels
    const studentSnap = await adminDb
      .collection("Students")
      .where("uid", "==", session.uid)
      .limit(1)
      .get();

    if (studentSnap.empty) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 }
      );
    }

    const studentData = studentSnap.docs[0].data();
    const eotcUid = (studentData.eotcUid as string) || studentSnap.docs[0].id;

    // Check if a DIRECT channel already exists for this student
    // familyId = fatherId for students
    const familyId = session.familyId;
    if (!familyId) {
      return NextResponse.json(
        { error: "No familyId in session" },
        { status: 400 }
      );
    }

    const existingDirectSnap = await adminDb
      .collection("ChannelMembers")
      .where("userId", "==", session.uid)
      .where("isActive", "==", true)
      .get();

    // Check if any of these memberships are DIRECT channels
    const channelIds = existingDirectSnap.docs.map((d) => d.data().channelId);
    let hasDirectChannel = false;

    if (channelIds.length > 0) {
      // Batch check — find if any channelId is type DIRECT
      for (const cid of channelIds) {
        const chanSnap = await adminDb
          .collection("Channels")
          .doc(cid)
          .get();
        if (chanSnap.exists && chanSnap.data()?.type === "DIRECT") {
          hasDirectChannel = true;
          break;
        }
      }
    }

    if (hasDirectChannel) {
      // All good — already has a direct channel
      return NextResponse.json({ ok: true, repaired: false });
    }

    // Missing DIRECT channel — trigger the join flow which will create it
    await joinStudentToFamilyChannels(session.uid as any, eotcUid);

    console.log(
      `[repair-channels] ✅ Repaired channels for student ${session.uid}`
    );

    return NextResponse.json({ ok: true, repaired: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[repair-channels] Failed:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
