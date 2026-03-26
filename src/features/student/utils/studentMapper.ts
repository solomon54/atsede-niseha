//src/features/student/utils/studentMapper.ts

import {
  SpiritualRelationship,
  Student,
  StudentAcademicProfile,
  StudentDocument,
} from "../types/student.types";

// ─────────────────────────────────────────────
// Timeline Types & Mapper (MVP)
// ─────────────────────────────────────────────

export interface StudentTimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "ACADEMIC" | "SPIRITUAL" | "OTHER";
}

// Simple mapper: identity mapping for MVP
export function mapTimeline(
  events: StudentTimelineEvent[]
): StudentTimelineEvent[] {
  // For MVP we just return the events directly
  // Later you can transform Firestore fields to domain types if needed
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    type: e.type,
  }));
}

// ─────────────────────────────────────────────
// Firestore → Domain
// ─────────────────────────────────────────────

export function mapStudentFromDoc(doc: StudentDocument): Student {
  const academics: StudentAcademicProfile = {
    university: doc.university,
    college: doc.college,
    department: doc.department,
    entryYear: doc.entryYear,
    academicYear: doc.academicYear,
    semester: doc.semester,
  };

  const relationship: SpiritualRelationship = {
    spiritualFatherId: doc.spiritualFatherId,
    fatherUid: doc.fatherId,
    familyId: doc.fatherId, // isolation boundary
  };

  return {
    uid: doc.uid,
    eotcUid: doc.eotcUid,

    fullName: doc.fullName,
    christianName: doc.christianName,
    secularName: doc.secularName,

    gender: doc.gender,
    birthDate: doc.birthDate,
    language: doc.language,

    email: doc.email,
    phone: doc.phone,
    photoUrl: doc.photoUrl,

    region: doc.region,
    zone: doc.zone,
    city: doc.city,
    diocese: doc.diocese,

    academics,
    relationship,
    spiritualTitle: doc.spiritualTitle,

    role: doc.role,
    status: doc.status,
    accountClaimed: doc.accountClaimed,

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastLogin: doc.lastLogin,
  };
}

// ─────────────────────────────────────────────
// Domain → Firestore
// ─────────────────────────────────────────────

export function mapStudentToDoc(student: Student): StudentDocument {
  return {
    uid: student.uid,
    eotcUid: student.eotcUid,

    fullName: student.fullName,
    christianName: student.christianName,
    secularName: student.secularName,

    gender: student.gender,
    birthDate: student.birthDate,

    language: student.language,
    email: student.email,
    phone: student.phone,
    photoUrl: student.photoUrl,

    region: student.region,
    zone: student.zone,
    city: student.city,
    diocese: student.diocese,

    university: student.academics.university,
    college: student.academics.college,
    department: student.academics.department,
    entryYear: student.academics.entryYear,
    academicYear: student.academics.academicYear,
    semester: student.academics.semester,

    fatherId: student.relationship.fatherUid,
    spiritualFatherId: student.relationship.spiritualFatherId,

    spiritualTitle: student.spiritualTitle,

    role: student.role,
    status: student.status,
    accountClaimed: student.accountClaimed,

    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    lastLogin: student.lastLogin,
  };
}

// ─────────────────────────────────────────────
// Safe Partial Update
// ─────────────────────────────────────────────

export function mapStudentUpdate(
  updates: Partial<Student>
): Partial<StudentDocument> {
  const doc: Partial<StudentDocument> = {};

  if (updates.fullName) doc.fullName = updates.fullName;
  if (updates.phone) doc.phone = updates.phone;
  if (updates.photoUrl) doc.photoUrl = updates.photoUrl;
  if (updates.language) doc.language = updates.language;

  if (updates.academics) {
    doc.university = updates.academics.university;
    doc.college = updates.academics.college;
    doc.department = updates.academics.department;
    doc.entryYear = updates.academics.entryYear;
    doc.academicYear = updates.academics.academicYear;
    doc.semester = updates.academics.semester;
  }

  doc.updatedAt = new Date().toISOString();

  return doc;
}
