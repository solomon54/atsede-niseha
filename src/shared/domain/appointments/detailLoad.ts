// src/shared/domain/appointments/detailLoad.ts
/**
 * Framework-independent pieces of the appointment-detail load lifecycle.
 *
 * The detail request is keyed only by the account and the requested
 * appointment id. Overview collection updates (list refresh, realtime upsert,
 * offline queue drain) deliberately do not change this key, so they cannot
 * re-trigger a detail fetch. Both Web and Android use these helpers.
 */

export interface AppointmentDetailView {
  kind: "overview" | "child" | "detail";
  appointmentId?: string;
}

export const APPOINTMENT_DETAIL_ERRORS = {
  UNAUTHORIZED: "እባክዎ እንደገና ይግቡ።",
  FORBIDDEN: "ይህን ቀጠሮ ለማየት ፈቃድ የለዎትም።",
  NOT_FOUND: "ቀጠሮው አልተገኘም ወይም ተደምስሷል።",
} as const;

/** Null means "no detail is open" and therefore no request must be made. */
export function appointmentDetailRequestKey(
  view: AppointmentDetailView,
  ownerUid: string
): string | null {
  if (!ownerUid || view.kind !== "detail") return null;
  const id = view.appointmentId?.trim();
  if (!id) return null;
  return `${ownerUid}\u0000${id}`;
}

/** Guards against applying a response after navigation or account change. */
export function isCurrentDetailRequest(
  requestKey: string | null,
  currentKey: string | null
): boolean {
  return requestKey !== null && requestKey === currentKey;
}

/** Terminal error mapping; every error path ends loading with a visible state. */
export function detailErrorMessage(
  status: number | null | undefined,
  fallback: string
): string {
  switch (status) {
    case 401:
      return APPOINTMENT_DETAIL_ERRORS.UNAUTHORIZED;
    case 403:
      return APPOINTMENT_DETAIL_ERRORS.FORBIDDEN;
    case 404:
      return APPOINTMENT_DETAIL_ERRORS.NOT_FOUND;
    default:
      return fallback;
  }
}
