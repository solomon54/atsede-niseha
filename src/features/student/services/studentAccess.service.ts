// src/features/student/services/studentAccess.service.ts

import { StudentPolicy } from "../policies/student.policy";
import { Student } from "../types/student.types";

export class StudentAccessService {
  static assertCanViewStudent(requesterUid: string, student: Student): void {
    const allowed = StudentPolicy.canView(requesterUid, student);

    if (!allowed) {
      throw new Error("Access denied");
    }
  }
}
