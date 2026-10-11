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
import {
  joinStudentToFamilyChannels,
  provisionFamilyChannels,
} from "@/features/messaging/services/channelProvision.service";
import { adminDb } from "@/services/firebase/admin";

export async function POST(): Promise<Response> {
  try {
    const session = await requireSession();

    // ─────────────────────────────────────────────
    // FATHER FLOW: Repair/provision direct channels for all claimed children
    // ─────────────────────────────────────────────
    if (session.role === "FATHER") {
      const fatherUid = session.uid;

      // Find father's EOTC ID
      const fatherDocSnap = await adminDb
        .collection("Fathers")
        .where("uid", "==", fatherUid)
        .limit(1)
        .get();

      const fatherEotcUid = fatherDocSnap.docs[0]?.data()?.eotcUid || "";

      // Find all students registered under this father who have claimed their accounts
      const queries = [
        adminDb.collection("Students").where("fatherId", "==", fatherUid).get(),
      ];

      if (fatherEotcUid) {
        queries.push(
          adminDb
            .collection("Students")
            .where("spiritualFatherId", "==", fatherEotcUid)
            .get()
        );
      }

      const results = await Promise.all(queries);
      const combinedDocs = new Map<string, any>();
      results.forEach((snap) => {
        snap.docs.forEach((d) => combinedDocs.set(d.id, d.data()));
      });

      const claimedStudents: Array<{ uid: string; eotcUid: string }> = [];
      combinedDocs.forEach((data, id) => {
        if (data.accountClaimed && data.uid) {
          claimedStudents.push({ uid: data.uid, eotcUid: data.eotcUid || id });
        }
      });

      if (claimedStudents.length === 0) {
        return NextResponse.json({ ok: true, repaired: false, count: 0 });
      }

      // Ensure family channels and direct channels exist for all claimed students
      const studentUids = claimedStudents.map((s) => s.uid);
      await provisionFamilyChannels(fatherUid as any, studentUids as any);

      console.log(
        `[repair-channels] ✅ Repaired channels for father ${fatherUid} across ${studentUids.length} students`
      );

      return NextResponse.json({
        ok: true,
        repaired: true,
        count: studentUids.length,
      });
    }

    // ─────────────────────────────────────────────
    // STUDENT FLOW: Repair direct & common house channels for the student
    // ─────────────────────────────────────────────
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
