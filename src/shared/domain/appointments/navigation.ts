// src/shared/domain/appointments/navigation.ts
/**
 * Framework-independent appointment navigation state.
 *
 * Child context is an appointment-room concern only. It must never turn into a
 * Child profile route, and it must never change how a detail request is keyed.
 */

import type { AppointmentRecord } from "./types";

export type AppointmentViewerRole = "FATHER" | "STUDENT";

export type AppointmentViewState =
  | { kind: "overview" }
  | { kind: "child"; childUid: string }
  | { kind: "detail"; appointmentId: string; childUid?: string };

export interface AppointmentRouteParams {
  child?: string | null;
  appointment?: string | null;
}

export interface AppointmentDetailChildContext {
  role: AppointmentViewerRole;
  knownChildUids?: Iterable<string>;
  appointment?: AppointmentRecord | null;
}

function firstTrimmed(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

/**
 * Rebuild the current view from URL/router params.
 *
 * Detail takes precedence. A Father's child param is carried into detail so a
 * refresh or deep link can return to the same appointment room. Students never
 * get child-oriented navigation.
 */
export function appointmentViewFromParams(
  params: AppointmentRouteParams,
  role: AppointmentViewerRole
): AppointmentViewState {
  const appointmentId = firstTrimmed(params.appointment);
  if (appointmentId) {
    const childUid = role === "FATHER" ? firstTrimmed(params.child) : undefined;
    return {
      kind: "detail",
      appointmentId,
      ...(childUid ? { childUid } : {}),
    };
  }

  if (role === "FATHER") {
    const childUid = firstTrimmed(params.child);
    if (childUid) return { kind: "child", childUid };
  }

  return { kind: "overview" };
}

/** Params for a URL that exactly reproduces a view. */
export function appointmentRouteParams(
  view: AppointmentViewState | AppointmentRouteParams
): { child?: string; appointment?: string } {
  if ("kind" in view) {
    if (view.kind === "detail") {
      return {
        appointment: view.appointmentId,
        ...(view.childUid ? { child: view.childUid } : {}),
      };
    }
    if (view.kind === "child") return { child: view.childUid };
    return {};
  }

  const child = firstTrimmed(view.child);
  const appointment = firstTrimmed(view.appointment);
  return {
    ...(child ? { child } : {}),
    ...(appointment ? { appointment } : {}),
  };
}

/**
 * Reconstruct child context from the loaded appointment when it is available;
 * a stale/mismatched URL child is never allowed to open the wrong room. Before
 * the detail loads, the explicitly carried child param is preserved.
 * Unknown/synthetic children are never accepted.
 */
export function resolveAppointmentDetailChildUid(
  view: AppointmentViewState,
  context: AppointmentDetailChildContext
): string | undefined {
  if (context.role !== "FATHER" || view.kind !== "detail") return undefined;

  const known = context.knownChildUids ? new Set(context.knownChildUids) : null;
  const candidates = [context.appointment?.childUid, view.childUid];

  for (const candidate of candidates) {
    const uid = firstTrimmed(candidate);
    if (!uid) continue;
    if (!known || known.has(uid)) return uid;
  }
  return undefined;
}

/** Back target for the in-app back control and Android hardware back. */
export function appointmentBackView(
  view: AppointmentViewState,
  context: AppointmentDetailChildContext
): AppointmentViewState {
  if (view.kind !== "detail") return { kind: "overview" };

  const childUid = resolveAppointmentDetailChildUid(view, context);
  return childUid ? { kind: "child", childUid } : { kind: "overview" };
}
