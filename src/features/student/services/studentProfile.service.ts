// src/features/student/services/studentProfile.service.ts

import { academicProgressFromEntry } from "@/shared/utils/calendar/ethiopianCalendar";
import { adminDb } from "@/services/firebase/admin";

import { mapStudentProfile } from "../utils/studentProfile.mapper";

export interface StudentProfileDocument {
  uid: string;
  fullName: string;
  christianName: string;
  email: string;
  photoUrl?: string;
  university: string;
  department: string;
  entryYear: number;
  programDuration: number;
  /** Computed at read time — never stored in Firestore */
  academicYear: number;
  semester: number;
  graduated: boolean;
  academicLabel: string;
  status: string;
  diocese: string;
  joinedAt: string;
}

export class StudentProfileService {
  /**
   * Fetches real data from the 'students' or 'users' collection
   */
  static async getProfile(studentId: string): Promise<StudentProfileDocument> {
    // 1. Fetch from Firestore
    const docRef = adminDb.collection("users").doc(studentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new Error("Student profile not found in registry");
    }

    const data = docSnap.data();

    // 2. Compute academic progress from stored fields
    const entryYear: number = data?.entryYear || new Date().getFullYear() - 8;
    const programDuration: number = data?.programDuration ?? 4;
    const gender: "MALE" | "FEMALE" = data?.gender === "FEMALE" ? "FEMALE" : "MALE";
    const progress = academicProgressFromEntry(entryYear, programDuration, gender);

    // 3. Map the raw Firestore data to our strict interface
    return {
      uid: studentId,
      fullName: data?.fullName || data?.displayName || "ያልታወቀ ስም",
      christianName: data?.christianName || "የእግዚአብሔር አገልጋይ",
      email: data?.email || "",
      photoUrl: data?.photoUrl,
      university: data?.university || "ያልተመደበ",
      department: data?.department || "ያልተገለጸ",
      entryYear,
      programDuration,
      academicYear: progress.academicYear,
      semester: progress.semester,
      graduated: progress.graduated,
      academicLabel: progress.label,
      status: data?.status || "PENDING",
      diocese: data?.diocese || "ያልተጠቀሰ",
      joinedAt: data?.createdAt
        ? new Date(data.createdAt._seconds * 1000).toLocaleDateString("am-ET")
        : "2017 ዓ.ም",
    };
  }
}
