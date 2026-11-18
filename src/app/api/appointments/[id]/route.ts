// src/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  applyAppointmentAction,
  AppointmentError,
  getAppointmentDetail,
} from "@/features/appointments/services/appointment.service";
import { UpdateAppointmentSchema } from "@/features/appointments/services/validators";

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

    const detail = await getAppointmentDetail({
      appointmentId: id,
      actorUid: session.uid,
      actorRole: session.role,
      familyId: session.familyId,
    });

    return NextResponse.json(detail);
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
    console.error("[GET /api/appointments/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;

    if (session.role !== "FATHER" && session.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await applyAppointmentAction({
      appointmentId: id,
      actorUid: session.uid,
      actorRole: session.role,
      familyId: session.familyId,
      input: parsed.data,
    });

    return NextResponse.json(result);
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
    console.error("[PATCH /api/appointments/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
