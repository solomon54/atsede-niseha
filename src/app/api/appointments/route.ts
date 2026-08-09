// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  AppointmentError,
  createAppointment,
  listAppointments,
  listFamilyChildren,
} from "@/features/appointments/services/appointment.service";
import { CreateAppointmentSchema } from "@/features/appointments/services/validators";

export async function GET() {
  try {
    const session = await requireSession();

    if (session.role !== "FATHER" && session.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [appointments, children] = await Promise.all([
      listAppointments({
        actorUid: session.uid,
        actorRole: session.role!,
        familyId: session.familyId,
      }),
      session.role === "FATHER"
        ? listFamilyChildren(session.familyId)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ success: true, appointments, children });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/appointments]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    if (session.role !== "FATHER" && session.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const childUid =
      session.role === "STUDENT" ? session.uid : parsed.data.childUid;

    const appointment = await createAppointment({
      actorUid: session.uid,
      actorRole: session.role!,
      familyId: session.familyId,
      input: { ...parsed.data, childUid },
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    if (err instanceof AppointmentError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/appointments]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
