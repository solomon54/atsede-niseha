// src/app/api/appointments/[id]/history/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  AppointmentError,
  getAppointmentHistory,
} from "@/features/appointments/services/appointment.service";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;

    if (session.role !== "FATHER" && session.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = await getAppointmentHistory({
      appointmentId: id,
      actorUid: session.uid,
      actorRole: session.role,
      familyId: session.familyId,
    });

    return NextResponse.json(history);
  } catch (err) {
    if (err instanceof AppointmentError) {
      return NextResponse.json(
        { error: err.message, code: err.code, ...(err.details ?? {}) },
        { status: err.status }
      );
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/appointments/:id/history]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
