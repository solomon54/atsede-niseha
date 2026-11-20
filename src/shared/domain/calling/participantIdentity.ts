// src/shared/domain/calling/participantIdentity.ts

export type CallRole = "FATHER" | "STUDENT" | "GOVERNOR" | "CHILD";
export type ProfileCollection = "Fathers" | "Students" | "Governors";

export interface CallParticipantSummary {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: CallRole;
}

export const CALL_ROLE_LABELS: Record<CallRole, string> = {
  FATHER: "የንስሐ አባት",
  STUDENT: "የንስሐ ልጅ",
  GOVERNOR: "የንስሐ ገዥ",
  CHILD: "የንስሐ ልጅ",
};

export function normalizeCallRole(role: unknown, collection?: string): CallRole {
  if (role === "FATHER" || role === "GOVERNOR" || role === "CHILD" || role === "STUDENT") {
    return role;
  }
  if (collection === "Fathers") return "FATHER";
  if (collection === "Governors") return "GOVERNOR";
  return "STUDENT";
}

export function callRoleLabel(role: unknown, collection?: string): string {
  return CALL_ROLE_LABELS[normalizeCallRole(role, collection)];
}

export function resolveProfilePhoto(data: Record<string, unknown>): string | null {
  for (const key of ["photoUrl", "avatarUrl", "profileImage", "profilePhotoUrl"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function resolveDisplayName(
  data: Record<string, unknown>,
  role: CallRole
): string {
  for (const key of ["christianName", "fullName", "secularName"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return CALL_ROLE_LABELS[role];
}

/** Resolve identity from a Firestore profile using the collection as role evidence. */
export function toCallParticipantSummary(args: {
  uid: string;
  collection: ProfileCollection;
  data: Record<string, unknown>;
}): CallParticipantSummary {
  const role = normalizeCallRole(args.data.role, args.collection);
  return {
    uid: args.uid,
    displayName: resolveDisplayName(args.data, role),
    photoUrl: resolveProfilePhoto(args.data),
    role,
  };
}
