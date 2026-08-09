// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/core/auth/requireSession";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/appointments/services/notification.service";

export async function GET() {
  try {
    const session = await requireSession();
    const notifications = await listNotificationsForUser(session.uid);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      const count = await markAllNotificationsRead(session.uid);
      return NextResponse.json({ success: true, marked: count });
    }

    if (!body.notificationId) {
      return NextResponse.json(
        { error: "notificationId required" },
        { status: 400 }
      );
    }

    await markNotificationRead(body.notificationId, session.uid);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/notifications]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
