//src/features/student/utils/studentProfile.mapper.ts

import { StudentProfileDocument } from "../types/student.types";

/**
 * Map raw document → simplified profile
 */
export function mapStudentProfile(doc: StudentProfileDocument) {
  return {
    uid: doc.uid,
    fullName: doc.fullName,
    christianName: doc.christianName,
    photoUrl: doc.photoUrl,
    university: doc.university,
    department: doc.department,
    academicYear: doc.academicYear,
    status: doc.status,
  };
}
