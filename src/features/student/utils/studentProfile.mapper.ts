//src/features/student/utils/studentProfile.mapper.ts

import { academicProgressFromEntry } from "@/shared/utils/calendar/ethiopianCalendar";

import { StudentProfileDocument } from "../types/student.types";

/**
 * Map raw Firestore document → simplified profile.
 * academicYear, semester, graduated are computed — never read from DB.
 */
export function mapStudentProfile(doc: StudentProfileDocument & { gender?: "MALE" | "FEMALE" }) {
  const programDuration = doc.programDuration ?? 4;
  const gender = doc.gender ?? "MALE";
  const progress = academicProgressFromEntry(doc.entryYear, programDuration, gender);

  return {
    uid: doc.uid,
    fullName: doc.fullName,
    christianName: doc.christianName,
    photoUrl: doc.photoUrl,
    university: doc.university,
    department: doc.department,
    entryYear: doc.entryYear,
    programDuration,
    gender,
    academicYear: progress.academicYear,
    semester: progress.semester,
    graduated: progress.graduated,
    academicLabel: progress.label,
    status: doc.status,
  };
}
