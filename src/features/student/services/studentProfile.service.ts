// src/features/student/services/studentProfile.service.ts

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
  academicYear: number;
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

    // 2. Map the raw Firestore data to our strict interface
    return {
      uid: studentId,
      fullName: data?.fullName || data?.displayName || "ያልታወቀ ስም",
      christianName: data?.christianName || "የእግዚአብሔር አገልጋይ",
      email: data?.email || "",
      photoUrl: data?.photoUrl,
      university: data?.university || "ያልተመደበ",
      department: data?.department || "ያልተገለጸ",
      academicYear: data?.academicYear || 0,
      status: data?.status || "PENDING",
      diocese: data?.diocese || "ያልተጠቀሰ",
      joinedAt: data?.createdAt
        ? new Date(data.createdAt._seconds * 1000).toLocaleDateString("am-ET")
        : "2017 ዓ.ም",
    };
  }
}
